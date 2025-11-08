import { TypedEventEmitter } from "@libp2p/interface";
import { createDecoder, createEncoder } from "@waku/core";
import {
  AutoSharding,
  IDecodedMessage,
  IDecoder,
  IEncoder
} from "@waku/interfaces";
import {
  createRoutingInfo,
  delay,
  MockWakuEvents,
  MockWakuNode
} from "@waku/utils";
import { utf8ToBytes } from "@waku/utils/bytes";
import { expect } from "chai";
import { beforeEach, describe } from "mocha";

import { ReliableChannel, StatusDetail } from "./index.js";

const TEST_CONTENT_TOPIC = "/my-tests/0/topic-name/proto";
const TEST_NETWORK_CONFIG: AutoSharding = {
  clusterId: 0,
  numShardsInCluster: 1
};
const TEST_ROUTING_INFO = createRoutingInfo(TEST_NETWORK_CONFIG, {
  contentTopic: TEST_CONTENT_TOPIC
});

describe("Status", () => {
  let encoder: IEncoder;
  let decoder: IDecoder<IDecodedMessage>;

  beforeEach(async () => {
    encoder = createEncoder({
      contentTopic: TEST_CONTENT_TOPIC,
      routingInfo: TEST_ROUTING_INFO
    });
    decoder = createDecoder(TEST_CONTENT_TOPIC, TEST_ROUTING_INFO);
  });

  it("Synced status is emitted when a message is received", async () => {
    const commonEventEmitter = new TypedEventEmitter<MockWakuEvents>();
    const mockWakuNodeAlice = new MockWakuNode(commonEventEmitter);
    const mockWakuNodeBob = new MockWakuNode(commonEventEmitter);

    const reliableChannelAlice = await ReliableChannel.create(
      mockWakuNodeAlice,
      "MyChannel",
      "alice",
      encoder,
      decoder
    );
    const reliableChannelBob = await ReliableChannel.create(
      mockWakuNodeBob,
      "MyChannel",
      "bob",
      encoder,
      decoder
    );

    let statusDetail: StatusDetail;
    reliableChannelBob.status.addEventListener("synced", (event) => {
      statusDetail = event.detail;
    });

    const message = utf8ToBytes("message in channel");

    reliableChannelAlice.send(message);
    while (!statusDetail!) {
      await delay(50);
    }

    expect(statusDetail.received).to.eq(1);
  });

  it("Synced status is emitted when a missing message is received", async () => {
    const commonEventEmitter = new TypedEventEmitter<MockWakuEvents>();
    const mockWakuNodeAlice = new MockWakuNode(commonEventEmitter);
    const mockWakuNodeBob = new MockWakuNode(commonEventEmitter);

    const reliableChannelAlice = await ReliableChannel.create(
      mockWakuNodeAlice,
      "MyChannel",
      "alice",
      encoder,
      decoder,
      {
        retryIntervalMs: 300 // shorter retry so that it resends message in test
      }
    );

    // Send a message before Bob goes online so it's marked as missing
    let messageSent = false;
    reliableChannelAlice.addEventListener("message-sent", (_event) => {
      messageSent = true;
    });
    reliableChannelAlice.send(utf8ToBytes("missing message"));
    while (!messageSent) {
      await delay(50);
    }

    const reliableChannelBob = await ReliableChannel.create(
      mockWakuNodeBob,
      "MyChannel",
      "bob",
      encoder,
      decoder
    );

    let syncingStatusDetail: StatusDetail;
    reliableChannelBob.status.addEventListener("syncing", (event) => {
      syncingStatusDetail = event.detail;
    });

    let syncedStatusDetail: StatusDetail;
    reliableChannelBob.status.addEventListener("synced", (event) => {
      syncedStatusDetail = event.detail;
    });

    messageSent = false;
    reliableChannelAlice.addEventListener("message-sent", (_event) => {
      messageSent = true;
    });
    reliableChannelAlice.send(
      utf8ToBytes("second message with missing message as dep")
    );
    while (!messageSent) {
      await delay(50);
    }

    while (!syncingStatusDetail!) {
      await delay(50);
    }

    expect(syncingStatusDetail.missing).to.eq(1);
    expect(syncingStatusDetail.received).to.eq(1);

    while (!syncedStatusDetail!) {
      await delay(50);
    }

    expect(syncedStatusDetail.missing).to.eq(0);
    expect(syncedStatusDetail.received).to.eq(2);
  });

  it("Synced status is emitted when a missing message is mark as lost", async () => {
    const commonEventEmitter = new TypedEventEmitter<MockWakuEvents>();
    const mockWakuNodeAlice = new MockWakuNode(commonEventEmitter);
    const mockWakuNodeBob = new MockWakuNode(commonEventEmitter);

    const reliableChannelAlice = await ReliableChannel.create(
      mockWakuNodeAlice,
      "MyChannel",
      "alice",
      encoder,
      decoder,
      {
        syncMinIntervalMs: 0,
        retryIntervalMs: 0 // Do not retry so we can lose the message
      }
    );

    // Send a message before Bob goes online so it's marked as missing
    let messageSent = false;
    reliableChannelAlice.addEventListener("message-sent", (_event) => {
      messageSent = true;
    });
    reliableChannelAlice.send(utf8ToBytes("missing message"));
    while (!messageSent) {
      await delay(50);
    }

    const reliableChannelBob = await ReliableChannel.create(
      mockWakuNodeBob,
      "MyChannel",
      "bob",
      encoder,
      decoder,
      {
        retrieveFrequencyMs: 0,
        syncMinIntervalMs: 0,
        sweepInBufIntervalMs: 50, // frequently sweep incoming buffer to mark msg as lost
        timeoutForLostMessagesMs: 200 // timeout within the test
      }
    );

    let syncingStatusDetail: StatusDetail;
    reliableChannelBob.status.addEventListener("syncing", (event) => {
      syncingStatusDetail = event.detail;
    });

    messageSent = false;
    reliableChannelAlice.addEventListener("message-sent", (_event) => {
      messageSent = true;
    });
    reliableChannelAlice.send(
      utf8ToBytes("second message with missing message as dep")
    );
    while (!messageSent) {
      await delay(50);
    }

    while (!syncingStatusDetail!) {
      await delay(50);
    }

    expect(syncingStatusDetail.missing).to.eq(1, "at first, one missing");
    expect(syncingStatusDetail.received).to.eq(1, "at first, one received");
    expect(syncingStatusDetail.lost).to.eq(0, "at first, no loss");

    let syncedStatusDetail: StatusDetail;
    reliableChannelBob.status.addEventListener("synced", (event) => {
      syncedStatusDetail = event.detail;
    });
    while (!syncedStatusDetail!) {
      await delay(50);
    }

    expect(syncedStatusDetail.missing).to.eq(0, "no more missing message");
    expect(syncedStatusDetail.received).to.eq(1, "still one received message");
    expect(syncedStatusDetail.lost).to.eq(1, "missing message is marked lost");
  });
});

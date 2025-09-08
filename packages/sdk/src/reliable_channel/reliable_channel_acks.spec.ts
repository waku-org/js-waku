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
import { bytesToUtf8, utf8ToBytes } from "@waku/utils/bytes";
import { expect } from "chai";
import { beforeEach, describe } from "mocha";

import { ReliableChannel, ReliableChannelEvent } from "./index.js";

const TEST_CONTENT_TOPIC = "/my-tests/0/topic-name/proto";
const TEST_NETWORK_CONFIG: AutoSharding = {
  clusterId: 0,
  numShardsInCluster: 1
};
const TEST_ROUTING_INFO = createRoutingInfo(TEST_NETWORK_CONFIG, {
  contentTopic: TEST_CONTENT_TOPIC
});

describe("Reliable Channel: Acks", () => {
  let encoder: IEncoder;
  let decoder: IDecoder<IDecodedMessage>;

  beforeEach(async () => {
    encoder = createEncoder({
      contentTopic: TEST_CONTENT_TOPIC,
      routingInfo: TEST_ROUTING_INFO
    });
    decoder = createDecoder(TEST_CONTENT_TOPIC, TEST_ROUTING_INFO);
  });

  it("Outgoing message is acknowledged", async () => {
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

    const message = utf8ToBytes("first message in channel");

    // Alice sets up message tracking
    const messageId = ReliableChannel.getMessageId(message);

    let messageReceived = false;
    reliableChannelBob.addEventListener(
      ReliableChannelEvent.InMessageReceived,
      (event) => {
        if (bytesToUtf8(event.detail.payload) === "first message in channel") {
          messageReceived = true;
        }
      }
    );

    let messageAcknowledged = false;
    reliableChannelAlice.addEventListener(
      ReliableChannelEvent.OutMessageAcknowledged,
      (event) => {
        if (event.detail === messageId) {
          messageAcknowledged = true;
        }
      }
    );

    reliableChannelAlice.send(message);

    // Wait for Bob to receive the message to ensure it uses it in causal history
    while (!messageReceived) {
      await delay(50);
    }
    // Bobs sends a message now, it should include first one in causal history
    reliableChannelBob.send(utf8ToBytes("second message in channel"));
    while (!messageAcknowledged) {
      await delay(50);
    }

    expect(messageAcknowledged).to.be.true;
  });

  it("Re-sent message is acknowledged once other parties join.", async () => {
    const commonEventEmitter = new TypedEventEmitter<MockWakuEvents>();
    const mockWakuNodeAlice = new MockWakuNode(commonEventEmitter);

    // Setup, Alice first
    const reliableChannelAlice = await ReliableChannel.create(
      mockWakuNodeAlice,
      "MyChannel",
      "alice",
      encoder,
      decoder,
      {
        retryIntervalMs: 0, // disable any automation to better control the test
        syncMinIntervalMs: 0
      }
    );

    // Bob is offline, Alice sends a message, this is the message we want
    // acknowledged in this test.
    const message = utf8ToBytes("message to be acknowledged");
    const messageId = ReliableChannel.getMessageId(message);
    let messageAcknowledged = false;
    reliableChannelAlice.addEventListener(
      ReliableChannelEvent.OutMessageAcknowledged,
      (event) => {
        if (event.detail === messageId) {
          messageAcknowledged = true;
        }
      }
    );
    reliableChannelAlice.send(message);

    // Wait a bit to ensure Bob does not receive the message
    await delay(100);

    // Now Bob goes online
    const mockWakuNodeBob = new MockWakuNode(commonEventEmitter);
    const reliableChannelBob = await ReliableChannel.create(
      mockWakuNodeBob,
      "MyChannel",
      "bob",
      encoder,
      decoder,
      {
        retryIntervalMs: 0, // disable any automation to better control the test
        syncMinIntervalMs: 0
      }
    );

    // Track when Bob receives the message
    let bobReceivedMessage = false;
    reliableChannelBob.addEventListener(
      ReliableChannelEvent.InMessageReceived,
      (event) => {
        if (
          bytesToUtf8(event.detail.payload!) === "message to be acknowledged"
        ) {
          bobReceivedMessage = true;
        }
      }
    );

    // Some sync messages are exchanged
    await reliableChannelAlice["sendSyncMessage"]();
    await reliableChannelBob["sendSyncMessage"]();

    // wait a bit to ensure messages are processed
    await delay(100);

    // Some content messages are exchanged too
    reliableChannelAlice.send(utf8ToBytes("some message"));
    reliableChannelBob.send(utf8ToBytes("some other message"));

    // wait a bit to ensure messages are processed
    await delay(100);

    // At this point, the message shouldn't be acknowledged yet as Bob
    // does not have a complete log
    expect(messageAcknowledged).to.be.false;

    // Now Alice resends the message
    reliableChannelAlice.send(message);

    // Wait for Bob to receive the message
    while (!bobReceivedMessage) {
      await delay(50);
    }

    // Bob receives it, and should include it in its sync
    await reliableChannelBob["sendSyncMessage"]();
    while (!messageAcknowledged) {
      await delay(50);
    }

    // The sync should acknowledge the message
    expect(messageAcknowledged).to.be.true;
  });
});

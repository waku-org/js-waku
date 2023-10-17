import { DefaultPubSubTopic } from "@waku/core";
import { RelayNode } from "@waku/interfaces";
import { createRelayNode } from "@waku/sdk";
import { utf8ToBytes } from "@waku/utils/bytes";
import { expect } from "chai";

import {
  MessageCollector,
  NOISE_KEY_1,
  NOISE_KEY_2,
  tearDownNodes
} from "../../src/index.js";

import {
  log,
  messageText,
  TestContentTopic,
  TestDecoder,
  TestEncoder,
  waitForAllRemotePeers
} from "./utils.js";

describe("Waku Relay, Subscribe", function () {
  this.timeout(15000);
  let waku1: RelayNode;
  let waku2: RelayNode;

  beforeEach(async function () {
    this.timeout(10000);
    log("Starting JS Waku instances");
    [waku1, waku2] = await Promise.all([
      createRelayNode({
        pubsubTopics: [DefaultPubSubTopic],
        staticNoiseKey: NOISE_KEY_1
      }).then((waku) => waku.start().then(() => waku)),
      createRelayNode({
        pubsubTopics: [DefaultPubSubTopic],
        staticNoiseKey: NOISE_KEY_2,
        libp2p: { addresses: { listen: ["/ip4/0.0.0.0/tcp/0/ws"] } }
      }).then((waku) => waku.start().then(() => waku))
    ]);
    log("Instances started, adding waku2 to waku1's address book");
    await waku1.libp2p.peerStore.merge(waku2.libp2p.peerId, {
      multiaddrs: waku2.libp2p.getMultiaddrs()
    });
    await waku1.dial(waku2.libp2p.peerId);
    log("before each hook done");
  });

  afterEach(async function () {
    this.timeout(15000);
    await tearDownNodes([], [waku1, waku2]);
  });

  it("Mutual subscription", async function () {
    await waitForAllRemotePeers(waku1, waku2);
    const subscribers1 = waku1.libp2p.services
      .pubsub!.getSubscribers(DefaultPubSubTopic)
      .map((p) => p.toString());
    const subscribers2 = waku2.libp2p.services
      .pubsub!.getSubscribers(DefaultPubSubTopic)
      .map((p) => p.toString());

    expect(subscribers1).to.contain(waku2.libp2p.peerId.toString());
    expect(subscribers2).to.contain(waku1.libp2p.peerId.toString());
  });

  it("Register correct protocols", async function () {
    const protocols = waku1.libp2p.getProtocols();

    expect(protocols).to.contain("/vac/waku/relay/2.0.0");
    expect(protocols.findIndex((value) => value.match(/sub/))).to.eq(-1);
  });

  it("Publish without waiting for remote peer", async function () {
    try {
      await waku1.relay.send(TestEncoder, {
        payload: utf8ToBytes(messageText)
      });
      throw new Error("Publish was successful but was expected to fail");
    } catch (err) {
      if (
        !(err instanceof Error) ||
        !err.message.includes("PublishError.InsufficientPeers")
      ) {
        throw err;
      }
    }
  });

  it("Subscribe and publish message", async function () {
    await waitForAllRemotePeers(waku1, waku2);
    const messageTimestamp = new Date("1995-12-17T03:24:00");
    const message = {
      payload: utf8ToBytes(messageText),
      timestamp: messageTimestamp
    };

    const messageCollector = new MessageCollector();
    await waku2.relay.subscribe([TestDecoder], messageCollector.callback);

    const pushResponse = await waku1.relay.send(TestEncoder, message);

    expect(pushResponse.recipients.length).to.eq(1);
    expect(pushResponse.recipients[0].toString()).to.eq(
      waku2.libp2p.peerId.toString()
    );

    expect(await messageCollector.waitForMessages(1)).to.eq(true);

    messageCollector.verifyReceivedMessage(0, {
      expectedMessageText: messageText,
      expectedContentTopic: TestContentTopic,
      expectedTimestamp: messageTimestamp.valueOf()
    });
  });
});

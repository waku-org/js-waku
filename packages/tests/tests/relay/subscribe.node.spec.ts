import { createDecoder, createEncoder, DefaultPubsubTopic } from "@waku/core";
import { RelayNode } from "@waku/interfaces";
import { createRelayNode } from "@waku/sdk";
import { utf8ToBytes } from "@waku/utils/bytes";
import { expect } from "chai";

import {
  generateTestData,
  MessageCollector,
  NOISE_KEY_1,
  NOISE_KEY_2,
  tearDownNodes,
  TEST_STRING
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
  this.timeout(40000);
  let waku1: RelayNode;
  let waku2: RelayNode;
  let messageCollector: MessageCollector;

  beforeEach(async function () {
    this.timeout(10000);
    log.info("Starting JS Waku instances");
    [waku1, waku2] = await Promise.all([
      createRelayNode({
        pubsubTopics: [DefaultPubsubTopic],
        staticNoiseKey: NOISE_KEY_1
      }).then((waku) => waku.start().then(() => waku)),
      createRelayNode({
        pubsubTopics: [DefaultPubsubTopic],
        staticNoiseKey: NOISE_KEY_2,
        libp2p: { addresses: { listen: ["/ip4/0.0.0.0/tcp/0/ws"] } }
      }).then((waku) => waku.start().then(() => waku))
    ]);
    log.info("Instances started, adding waku2 to waku1's address book");
    await waku1.libp2p.peerStore.merge(waku2.libp2p.peerId, {
      multiaddrs: waku2.libp2p.getMultiaddrs()
    });
    await waku1.dial(waku2.libp2p.peerId);
    log.info("before each hook done");
    messageCollector = new MessageCollector();
  });

  afterEach(async function () {
    this.timeout(15000);
    await tearDownNodes([], [waku1, waku2]);
  });

  it("Mutual subscription", async function () {
    await waitForAllRemotePeers(waku1, waku2);
    const subscribers1 = waku1.libp2p.services
      .pubsub!.getSubscribers(DefaultPubsubTopic)
      .map((p) => p.toString());
    const subscribers2 = waku2.libp2p.services
      .pubsub!.getSubscribers(DefaultPubsubTopic)
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
    await waku2.relay.subscribe([TestDecoder], messageCollector.callback);
    await waku1.relay.send(TestEncoder, { payload: utf8ToBytes(messageText) });
    expect(await messageCollector.waitForMessages(1)).to.eq(true);
    messageCollector.verifyReceivedMessage(0, {
      expectedMessageText: messageText,
      expectedContentTopic: TestContentTopic
    });
  });

  it("Subscribe and publish 10000 messages on the same topic", async function () {
    const messageCount = 10000;
    await waitForAllRemotePeers(waku1, waku2);
    await waku2.relay.subscribe([TestDecoder], messageCollector.callback);
    // Send a unique message on each topic.
    for (let i = 0; i < messageCount; i++) {
      await waku1.relay.send(TestEncoder, {
        payload: utf8ToBytes(`M${i + 1}`)
      });
    }

    // Verify that each message was received on the corresponding topic.
    expect(
      await messageCollector.waitForMessages(messageCount, { exact: true })
    ).to.eq(true);

    for (let i = 0; i < messageCount; i++) {
      messageCollector.verifyReceivedMessage(i, {
        expectedMessageText: `M${i + 1}`,
        expectedContentTopic: TestContentTopic,
        checkTimestamp: false
      });
    }
  });

  it("Subscribe and publish messages on 2 different content topics", async function () {
    const secondContentTopic = "/test/2/waku-relay/utf8";
    const secondEncoder = createEncoder({ contentTopic: secondContentTopic });
    const secondDecoder = createDecoder(secondContentTopic);

    await waitForAllRemotePeers(waku1, waku2);
    await waku2.relay.subscribe([TestDecoder], messageCollector.callback);
    await waku2.relay.subscribe([secondDecoder], messageCollector.callback);
    await waku1.relay.send(TestEncoder, { payload: utf8ToBytes("M1") });
    await waku1.relay.send(secondEncoder, { payload: utf8ToBytes("M2") });
    expect(await messageCollector.waitForMessages(2, { exact: true })).to.eq(
      true
    );
    messageCollector.verifyReceivedMessage(0, {
      expectedMessageText: "M1",
      expectedContentTopic: TestContentTopic
    });
    messageCollector.verifyReceivedMessage(1, {
      expectedMessageText: "M2",
      expectedContentTopic: secondContentTopic
    });
  });

  it("Subscribe one by one to 100 topics and publish messages", async function () {
    const topicCount = 100;
    const td = generateTestData(topicCount);
    await waitForAllRemotePeers(waku1, waku2);

    // Subscribe to topics one by one
    for (let i = 0; i < topicCount; i++) {
      await waku2.relay.subscribe([td.decoders[i]], messageCollector.callback);
    }

    // Send a unique message on each topic.
    for (let i = 0; i < topicCount; i++) {
      await waku1.relay.send(td.encoders[i], {
        payload: utf8ToBytes(`Message for Topic ${i + 1}`)
      });
    }

    // Verify that each message was received on the corresponding topic.
    expect(
      await messageCollector.waitForMessages(topicCount, { exact: true })
    ).to.eq(true);
    td.contentTopics.forEach((topic, index) => {
      messageCollector.verifyReceivedMessage(index, {
        expectedContentTopic: topic,
        expectedMessageText: `Message for Topic ${index + 1}`
      });
    });
  });

  it("Subscribe at once to 10000 topics and publish messages", async function () {
    const topicCount = 10000;
    const td = generateTestData(topicCount);
    await waitForAllRemotePeers(waku1, waku2);

    // Subscribe to all topics at once
    await waku2.relay.subscribe(td.decoders, messageCollector.callback);

    // Send a unique message on each topic.
    for (let i = 0; i < topicCount; i++) {
      await waku1.relay.send(td.encoders[i], {
        payload: utf8ToBytes(`Message for Topic ${i + 1}`)
      });
    }

    // Verify that each message was received on the corresponding topic.
    expect(
      await messageCollector.waitForMessages(topicCount, { exact: true })
    ).to.eq(true);
    td.contentTopics.forEach((topic, index) => {
      messageCollector.verifyReceivedMessage(index, {
        expectedContentTopic: topic,
        expectedMessageText: `Message for Topic ${index + 1}`,
        checkTimestamp: false
      });
    });
  });

  // Will be skipped until https://github.com/waku-org/js-waku/issues/1678 is fixed
  it.skip("Refresh subscription", async function () {
    await waitForAllRemotePeers(waku1, waku2);

    await waku2.relay.subscribe([TestDecoder], messageCollector.callback);
    await waku2.relay.subscribe([TestDecoder], messageCollector.callback);

    await waku1.relay.send(TestEncoder, { payload: utf8ToBytes("M1") });

    expect(await messageCollector.waitForMessages(1, { exact: true })).to.eq(
      true
    );
  });

  // Will be skipped until https://github.com/waku-org/js-waku/issues/1678 is fixed
  it.skip("Overlapping topic subscription", async function () {
    // Define two sets of test data with overlapping topics.
    const topicCount1 = 2;
    const td1 = generateTestData(topicCount1);
    const topicCount2 = 4;
    const td2 = generateTestData(topicCount2);
    await waitForAllRemotePeers(waku1, waku2);

    // Subscribe to the first set of topics.
    await waku2.relay.subscribe(td1.decoders, messageCollector.callback);
    // Subscribe to the second set of topics which has overlapping topics with the first set.
    await waku2.relay.subscribe(td2.decoders, messageCollector.callback);

    // Send messages to the first set of topics.
    for (let i = 0; i < topicCount1; i++) {
      const messageText = `Message for Topic ${i + 1}`;
      await waku1.relay.send(td1.encoders[i], {
        payload: utf8ToBytes(messageText)
      });
    }

    // Send messages to the second set of topics.
    for (let i = 0; i < topicCount2; i++) {
      const messageText = `Message for Topic ${i + 3}`;
      await waku1.relay.send(td2.encoders[i], {
        payload: utf8ToBytes(messageText)
      });
    }

    // Check if all messages were received.
    // Since there are overlapping topics, there should be 6 messages in total (2 from the first set + 4 from the second set).
    expect(await messageCollector.waitForMessages(6, { exact: true })).to.eq(
      true
    );
  });

  TEST_STRING.forEach((testItem) => {
    it(`Subscribe to topic containing ${testItem.description} and publish message`, async function () {
      const newContentTopic = testItem.value;
      const newEncoder = createEncoder({ contentTopic: newContentTopic });
      const newDecoder = createDecoder(newContentTopic);
      await waitForAllRemotePeers(waku1, waku2);
      await waku2.relay.subscribe([newDecoder], messageCollector.callback);
      await waku1.relay.send(newEncoder, {
        payload: utf8ToBytes(messageText)
      });
      expect(await messageCollector.waitForMessages(1)).to.eq(true);
      messageCollector.verifyReceivedMessage(0, {
        expectedMessageText: messageText,
        expectedContentTopic: newContentTopic
      });
    });
  });
});

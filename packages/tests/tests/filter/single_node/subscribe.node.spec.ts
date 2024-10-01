import { createDecoder, createEncoder, waitForRemotePeer } from "@waku/core";
import { LightNode, Protocols } from "@waku/interfaces";
import {
  ecies,
  generatePrivateKey,
  generateSymmetricKey,
  getPublicKey,
  symmetric
} from "@waku/message-encryption";
import { utf8ToBytes } from "@waku/sdk";
import { expect } from "chai";
import type { Context } from "mocha";

import {
  afterEachCustom,
  beforeEachCustom,
  delay,
  generateTestData,
  MessageCollector,
  ServiceNode,
  tearDownNodes,
  TEST_STRING
} from "../../../src/index.js";
import {
  messagePayload,
  messageText,
  TestContentTopic,
  TestDecoder,
  TestEncoder,
  TestPubsubTopic,
  TestShardInfo
} from "../utils.js";

import { runNodes } from "./utils.js";

describe.only("Waku Filter V2: Subscribe: Single Service Node", function () {
  // Set the timeout for all tests in this suite. Can be overwritten at test level
  this.timeout(10000);
  let waku: LightNode;
  let waku2: LightNode;
  let nwaku: ServiceNode;
  let nwaku2: ServiceNode;
  let messageCollector: MessageCollector;
  let ctx: Context;

  beforeEachCustom(this, async () => {
    [nwaku, waku] = await runNodes(this.ctx, TestShardInfo);
    messageCollector = new MessageCollector();
    await nwaku.ensureSubscriptions([TestPubsubTopic]);
  });

  afterEachCustom(this, async () => {
    await tearDownNodes([nwaku, nwaku2], [waku, waku2]);
  });

  it("Subscribe and receive messages via lightPush", async function () {
    const { error } = await waku.filter.subscribe(
      [TestDecoder],
      messageCollector.callback
    );
    if (error) {
      throw error;
    }

    await waku.lightPush.send(TestEncoder, messagePayload);

    expect(await messageCollector.waitForMessages(1)).to.eq(true);
    messageCollector.verifyReceivedMessage(0, {
      expectedMessageText: messageText,
      expectedContentTopic: TestContentTopic,
      expectedPubsubTopic: TestPubsubTopic
    });
    expect((await nwaku.messages()).length).to.eq(1);
  });

  it("Subscribe and receive ecies encrypted messages via lightPush", async function () {
    const privateKey = generatePrivateKey();
    const publicKey = getPublicKey(privateKey);
    const encoder = ecies.createEncoder({
      contentTopic: TestContentTopic,
      publicKey,
      pubsubTopic: TestPubsubTopic
    });
    const decoder = ecies.createDecoder(
      TestContentTopic,
      privateKey,
      TestPubsubTopic
    );

    const { error } = await waku.filter.subscribe(
      [decoder],
      messageCollector.callback
    );
    if (error) {
      throw error;
    }

    await waku.lightPush.send(encoder, messagePayload);

    expect(await messageCollector.waitForMessages(1)).to.eq(true);
    messageCollector.verifyReceivedMessage(0, {
      expectedMessageText: messageText,
      expectedContentTopic: TestContentTopic,
      expectedVersion: 1,
      expectedPubsubTopic: TestPubsubTopic
    });
    expect((await nwaku.messages()).length).to.eq(1);
  });

  it("Subscribe and receive symmetrically encrypted messages via lightPush", async function () {
    const symKey = generateSymmetricKey();
    const encoder = symmetric.createEncoder({
      contentTopic: TestContentTopic,
      symKey,
      pubsubTopic: TestPubsubTopic
    });
    const decoder = symmetric.createDecoder(
      TestContentTopic,
      symKey,
      TestPubsubTopic
    );

    const { error } = await waku.filter.subscribe(
      [decoder],
      messageCollector.callback
    );
    if (error) {
      throw error;
    }

    await waku.lightPush.send(encoder, messagePayload);

    expect(await messageCollector.waitForMessages(1)).to.eq(true);
    messageCollector.verifyReceivedMessage(0, {
      expectedMessageText: messageText,
      expectedContentTopic: TestContentTopic,
      expectedVersion: 1,
      expectedPubsubTopic: TestPubsubTopic
    });
    expect((await nwaku.messages()).length).to.eq(1);
  });

  it("Subscribe and receive messages via waku relay post", async function () {
    const { error } = await waku.filter.subscribe(
      [TestDecoder],
      messageCollector.callback
    );
    if (error) {
      throw error;
    }

    await delay(400);

    // Send a test message using the relay post method.
    await nwaku.sendMessage(
      ServiceNode.toMessageRpcQuery({
        contentTopic: TestContentTopic,
        payload: utf8ToBytes(messageText)
      })
    );

    expect(await messageCollector.waitForMessages(1)).to.eq(true);
    messageCollector.verifyReceivedMessage(0, {
      expectedMessageText: messageText,
      expectedContentTopic: TestContentTopic,
      expectedPubsubTopic: TestPubsubTopic
    });
    expect((await nwaku.messages()).length).to.eq(1);
  });

  it("Subscribe and receive 2 messages on the same topic", async function () {
    await waku.filter.subscribe([TestDecoder], messageCollector.callback);

    await waku.lightPush.send(TestEncoder, messagePayload);

    expect(await messageCollector.waitForMessages(1)).to.eq(true);
    messageCollector.verifyReceivedMessage(0, {
      expectedMessageText: messageText,
      expectedContentTopic: TestContentTopic,
      expectedPubsubTopic: TestPubsubTopic
    });

    // Send another message on the same topic.
    const newMessageText = "Filtering still works!";
    await waku.lightPush.send(TestEncoder, {
      payload: utf8ToBytes(newMessageText)
    });

    // Verify that the second message was successfully received.
    expect(await messageCollector.waitForMessages(2)).to.eq(true);
    messageCollector.verifyReceivedMessage(1, {
      expectedMessageText: newMessageText,
      expectedContentTopic: TestContentTopic,
      expectedPubsubTopic: TestPubsubTopic
    });
    expect((await nwaku.messages()).length).to.eq(2);
  });

  it("Subscribe and receive messages on 2 different content topics", async function () {
    // Subscribe to the first content topic and send a message.
    const { error, subscription } = await waku.filter.subscribe(
      [TestDecoder],
      messageCollector.callback
    );
    if (error) {
      throw error;
    }
    await waku.lightPush.send(TestEncoder, messagePayload);
    expect(await messageCollector.waitForMessages(1)).to.eq(true);
    messageCollector.verifyReceivedMessage(0, {
      expectedMessageText: messageText,
      expectedContentTopic: TestContentTopic,
      expectedPubsubTopic: TestPubsubTopic
    });

    // Modify subscription to include a new content topic and send a message.
    const newMessageText = "Filtering still works!";
    const newMessagePayload = { payload: utf8ToBytes(newMessageText) };
    const newContentTopic = "/test/2/waku-filter/default";
    const newEncoder = createEncoder({
      contentTopic: newContentTopic,
      pubsubTopic: TestPubsubTopic
    });
    const newDecoder = createDecoder(newContentTopic, TestPubsubTopic);
    await subscription.subscribe([newDecoder], messageCollector.callback);
    await waku.lightPush.send(newEncoder, {
      payload: utf8ToBytes(newMessageText)
    });
    expect(await messageCollector.waitForMessages(2)).to.eq(true);
    messageCollector.verifyReceivedMessage(1, {
      expectedContentTopic: newContentTopic,
      expectedMessageText: newMessageText,
      expectedPubsubTopic: TestPubsubTopic
    });

    // Send another message on the initial content topic to verify it still works.
    await waku.lightPush.send(TestEncoder, newMessagePayload);
    expect(await messageCollector.waitForMessages(3)).to.eq(true);
    messageCollector.verifyReceivedMessage(2, {
      expectedMessageText: newMessageText,
      expectedContentTopic: TestContentTopic,
      expectedPubsubTopic: TestPubsubTopic
    });
    expect((await nwaku.messages()).length).to.eq(3);
  });

  it("Subscribe and receives messages on 20 topics", async function () {
    const topicCount = 20;
    const td = generateTestData(topicCount, { pubsubTopic: TestPubsubTopic });

    // Subscribe to all 20 topics.
    for (let i = 0; i < topicCount; i++) {
      await waku.filter.subscribe([td.decoders[i]], messageCollector.callback);
    }

    // Send a unique message on each topic.
    for (let i = 0; i < topicCount; i++) {
      await waku.lightPush.send(td.encoders[i], {
        payload: utf8ToBytes(`Message for Topic ${i + 1}`)
      });
    }

    // Verify that each message was received on the corresponding topic.
    expect(await messageCollector.waitForMessages(20)).to.eq(true);
    td.contentTopics.forEach((topic, index) => {
      messageCollector.verifyReceivedMessage(index, {
        expectedContentTopic: topic,
        expectedMessageText: `Message for Topic ${index + 1}`,
        expectedPubsubTopic: TestPubsubTopic
      });
    });
  });

  it.only("Subscribe to 100 topics (new limit) at once and receives messages", async function () {
    this.timeout(100_000);
    const topicCount = 100;
    const td = generateTestData(topicCount, { pubsubTopic: TestPubsubTopic });

    await waku.filter.subscribe(td.decoders, messageCollector.callback);

    // Send a unique message on each topic.
    for (let i = 0; i < topicCount; i++) {
      performance.mark("start");
      await waku.lightPush.send(td.encoders[i], {
        payload: utf8ToBytes(`Message for Topic ${i + 1}`)
      });
      performance.mark("end");
      const measure = performance.measure("lightPush", "start", "end");
      console.log("DEBUG:", measure.name, measure.duration);
    }

    // Verify that each message was received on the corresponding topic.
    expect(await messageCollector.waitForMessages(topicCount)).to.eq(true);
    td.contentTopics.forEach((topic, index) => {
      messageCollector.verifyReceivedMessage(index, {
        expectedContentTopic: topic,
        expectedMessageText: `Message for Topic ${index + 1}`,
        expectedPubsubTopic: TestPubsubTopic
      });
    });
  });

  it("Error when try to subscribe to more than 101 topics (new limit)", async function () {
    const topicCount = 101;
    const td = generateTestData(topicCount, { pubsubTopic: TestPubsubTopic });

    try {
      const { error, results } = await waku.filter.subscribe(
        td.decoders,
        messageCollector.callback
      );
      if (error) {
        throw error;
      }
      const { failures, successes } = results;
      if (failures.length === 0 || successes.length > 0) {
        throw new Error(
          `Subscribe to ${topicCount} topics was successful but was expected to fail with a specific error.`
        );
      }
    } catch (err) {
      if (
        err instanceof Error &&
        err.message.includes(
          `exceeds maximum content topics: ${topicCount - 1}`
        )
      ) {
        return;
      } else {
        throw err;
      }
    }
  });

  it("Overlapping topic subscription", async function () {
    // Define two sets of test data with overlapping topics.
    const topicCount1 = 2;
    const td1 = generateTestData(topicCount1, { pubsubTopic: TestPubsubTopic });
    const topicCount2 = 4;
    const td2 = generateTestData(topicCount2, { pubsubTopic: TestPubsubTopic });

    // Subscribe to the first set of topics.
    await waku.filter.subscribe(td1.decoders, messageCollector.callback);

    // Subscribe to the second set of topics which has overlapping topics with the first set.
    await waku.filter.subscribe(td2.decoders, messageCollector.callback);

    // Send messages to the first set of topics.
    for (let i = 0; i < topicCount1; i++) {
      const messageText = `Topic Set 1: Message Number: ${i + 1}`;
      await waku.lightPush.send(td1.encoders[i], {
        payload: utf8ToBytes(messageText)
      });
    }

    // Send messages to the second set of topics.
    for (let i = 0; i < topicCount2; i++) {
      const messageText = `Topic Set 2: Message Number: ${i + 1}`;

      await waku.lightPush.send(td2.encoders[i], {
        payload: utf8ToBytes(messageText)
      });
    }

    // Check if all messages were received.
    // Since there are overlapping topics, there should be 6 messages in total (2 from the first set + 4 from the second set).
    expect(await messageCollector.waitForMessages(6, { exact: true })).to.eq(
      true
    );
  });

  it("Refresh subscription", async function () {
    await waku.filter.subscribe([TestDecoder], messageCollector.callback);
    await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M1") });

    // Resubscribe (refresh) to the same topic and send another message.
    await waku.filter.subscribe([TestDecoder], messageCollector.callback);
    await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M2") });

    // Confirm both messages were received.
    expect(await messageCollector.waitForMessages(2, { exact: true })).to.eq(
      true
    );
    messageCollector.verifyReceivedMessage(0, {
      expectedMessageText: "M1",
      expectedContentTopic: TestContentTopic,
      expectedPubsubTopic: TestPubsubTopic
    });
    messageCollector.verifyReceivedMessage(1, {
      expectedMessageText: "M2",
      expectedContentTopic: TestContentTopic,
      expectedPubsubTopic: TestPubsubTopic
    });
  });

  TEST_STRING.forEach((testItem) => {
    it(`Subscribe to topic containing ${testItem.description} and receive message`, async function () {
      const newContentTopic = testItem.value;
      const newEncoder = createEncoder({
        contentTopic: newContentTopic,
        pubsubTopic: TestPubsubTopic
      });
      const newDecoder = createDecoder(newContentTopic, TestPubsubTopic);

      await waku.filter.subscribe([newDecoder], messageCollector.callback);
      await waku.lightPush.send(newEncoder, messagePayload);

      expect(await messageCollector.waitForMessages(1)).to.eq(true);
      messageCollector.verifyReceivedMessage(0, {
        expectedMessageText: messageText,
        expectedContentTopic: newContentTopic,
        expectedPubsubTopic: TestPubsubTopic
      });
    });
  });

  it("Add multiple subscription objects on single nwaku node", async function () {
    await waku.filter.subscribe([TestDecoder], messageCollector.callback);
    await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M1") });

    const newContentTopic = "/test/2/waku-filter/default";
    const newEncoder = createEncoder({
      contentTopic: newContentTopic,
      pubsubTopic: TestPubsubTopic
    });
    const newDecoder = createDecoder(newContentTopic, TestPubsubTopic);
    await waku.filter.subscribe([newDecoder], messageCollector.callback);

    await waku.lightPush.send(newEncoder, { payload: utf8ToBytes("M2") });

    // Check if both messages were received
    expect(await messageCollector.waitForMessages(2)).to.eq(true);
    messageCollector.verifyReceivedMessage(0, {
      expectedMessageText: "M1",
      expectedContentTopic: TestContentTopic,
      expectedPubsubTopic: TestPubsubTopic
    });
    messageCollector.verifyReceivedMessage(1, {
      expectedContentTopic: newContentTopic,
      expectedMessageText: "M2",
      expectedPubsubTopic: TestPubsubTopic
    });
  });

  it("Subscribe and receive messages from multiple nwaku nodes", async function () {
    await waku.filter.subscribe([TestDecoder], messageCollector.callback);

    // Set up and start a new nwaku node
    [nwaku2, waku2] = await runNodes(ctx, TestShardInfo);
    await waku.dial(await nwaku2.getMultiaddrWithId());
    await waitForRemotePeer(waku, [Protocols.Filter, Protocols.LightPush]);

    await nwaku2.ensureSubscriptions([TestPubsubTopic]);
    // Send a message using the new subscription
    const newContentTopic = "/test/2/waku-filter/default";
    const newEncoder = createEncoder({
      contentTopic: newContentTopic,
      pubsubTopic: TestPubsubTopic
    });
    const newDecoder = createDecoder(newContentTopic, TestPubsubTopic);
    await waku.filter.subscribe([newDecoder], messageCollector.callback);

    // Making sure that messages are send and reveiced for both subscriptions
    while (!(await messageCollector.waitForMessages(2))) {
      await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M1") });
      await waku.lightPush.send(newEncoder, { payload: utf8ToBytes("M2") });
    }

    // Check if both messages were received
    expect(messageCollector.hasMessage(TestContentTopic, "M1")).to.eq(true);
    expect(messageCollector.hasMessage(newContentTopic, "M2")).to.eq(true);
  });
});

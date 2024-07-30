import { createDecoder, createEncoder } from "@waku/core";
import { LightNode } from "@waku/interfaces";
import { utf8ToBytes } from "@waku/sdk";
import { expect } from "chai";

import {
  afterEachCustom,
  beforeEachCustom,
  generateTestData,
  MessageCollector,
  ServiceNode,
  tearDownNodes
} from "../../../src/index.js";
import { runNodes } from "../../light-push/utils";
import {
  messagePayload,
  messageText,
  TestContentTopic,
  TestDecoder,
  TestEncoder,
  TestPubsubTopic,
  TestShardInfo
} from "../utils.js";

describe("Waku Filter V2: Unsubscribe", function () {
  // Set the timeout for all tests in this suite. Can be overwritten at test level
  this.timeout(10000);
  let waku: LightNode;
  let nwaku: ServiceNode;
  let messageCollector: MessageCollector;

  beforeEachCustom(this, async () => {
    [nwaku, waku] = await runNodes(this.ctx, TestShardInfo);

    messageCollector = new MessageCollector();
    await nwaku.ensureSubscriptions([TestPubsubTopic]);
  });

  afterEachCustom(this, async () => {
    await tearDownNodes(nwaku, waku);
  });

  it("Unsubscribe 1 topic - node subscribed to 1 topic", async function () {
    const { subscription, error } = await waku.filter.subscribe(
      [TestDecoder],
      messageCollector.callback
    );
    if (error) {
      throw error;
    }
    await waku.lightPush.send(TestEncoder, messagePayload);
    expect(await messageCollector.waitForMessages(1)).to.eq(true);

    // Unsubscribe from the topic and send again
    await subscription.unsubscribe([TestContentTopic]);
    await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M1") });
    expect(await messageCollector.waitForMessages(2)).to.eq(false);

    // Check that from 2 messages send only the 1st was received
    messageCollector.verifyReceivedMessage(0, {
      expectedMessageText: messageText,
      expectedContentTopic: TestContentTopic,
      expectedPubsubTopic: TestPubsubTopic
    });
    expect(messageCollector.count).to.eq(1);
    expect((await nwaku.messages()).length).to.eq(2);
  });

  it("Unsubscribe 1 topic - node subscribed to 2 topics", async function () {
    // Subscribe to 2 topics and send messages
    const { error, subscription } = await waku.filter.subscribe(
      [TestDecoder],
      messageCollector.callback
    );
    if (error) {
      throw error;
    }
    const newContentTopic = "/test/2/waku-filter";
    const newEncoder = createEncoder({
      contentTopic: newContentTopic,
      pubsubTopic: TestPubsubTopic
    });
    const newDecoder = createDecoder(newContentTopic, TestPubsubTopic);
    await subscription.subscribe([newDecoder], messageCollector.callback);
    await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M1") });
    await waku.lightPush.send(newEncoder, { payload: utf8ToBytes("M2") });
    expect(await messageCollector.waitForMessages(2)).to.eq(true);

    // Unsubscribe from the first topic and send again
    await subscription.unsubscribe([TestContentTopic]);
    await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M3") });
    await waku.lightPush.send(newEncoder, { payload: utf8ToBytes("M4") });
    expect(await messageCollector.waitForMessages(3)).to.eq(true);

    // Check that from 4 messages send 3 were received
    expect(messageCollector.count).to.eq(3);
    expect((await nwaku.messages()).length).to.eq(4);
  });

  it("Unsubscribe 2 topics - node subscribed to 2 topics", async function () {
    // Subscribe to 2 topics and send messages
    const { error, subscription } = await waku.filter.subscribe(
      [TestDecoder],
      messageCollector.callback
    );
    if (error) {
      throw error;
    }
    const newContentTopic = "/test/2/waku-filter/default";
    const newEncoder = createEncoder({
      contentTopic: newContentTopic,
      pubsubTopic: TestPubsubTopic
    });
    const newDecoder = createDecoder(newContentTopic, TestPubsubTopic);
    await subscription.subscribe([newDecoder], messageCollector.callback);
    await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M1") });
    await waku.lightPush.send(newEncoder, { payload: utf8ToBytes("M2") });
    expect(await messageCollector.waitForMessages(2)).to.eq(true);

    // Unsubscribe from both and send again
    await subscription.unsubscribe([TestContentTopic, newContentTopic]);
    await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M3") });
    await waku.lightPush.send(newEncoder, { payload: utf8ToBytes("M4") });
    expect(await messageCollector.waitForMessages(3)).to.eq(false);

    // Check that from 4 messages send 2 were received
    expect(messageCollector.count).to.eq(2);
    expect((await nwaku.messages()).length).to.eq(4);
  });

  it("Unsubscribe topics the node is not subscribed to", async function () {
    // Subscribe to 1 topic and send message
    const { error, subscription } = await waku.filter.subscribe(
      [TestDecoder],
      messageCollector.callback
    );
    if (error) {
      throw error;
    }
    await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M1") });
    expect(await messageCollector.waitForMessages(1)).to.eq(true);

    expect(messageCollector.count).to.eq(1);

    // Unsubscribe from topics that the node is not not subscribed to and send again
    await subscription.unsubscribe([]);
    await subscription.unsubscribe(["/test/2/waku-filter/default"]);
    await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M2") });
    expect(await messageCollector.waitForMessages(2)).to.eq(true);

    // Check that both messages were received
    expect(messageCollector.count).to.eq(2);
    expect((await nwaku.messages()).length).to.eq(2);
  });

  it("Unsubscribes all - node subscribed to 1 topic", async function () {
    const { error, subscription } = await waku.filter.subscribe(
      [TestDecoder],
      messageCollector.callback
    );
    if (error) {
      throw error;
    }
    await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M1") });
    expect(await messageCollector.waitForMessages(1)).to.eq(true);
    expect(messageCollector.count).to.eq(1);

    // Unsubscribe from all topics and send again
    await subscription.unsubscribeAll();
    await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M2") });
    expect(await messageCollector.waitForMessages(2)).to.eq(false);

    // Check that from 2 messages send only the 1st was received
    expect(messageCollector.count).to.eq(1);
    expect((await nwaku.messages()).length).to.eq(2);
  });

  it("Unsubscribes all - node subscribed to 10 topics", async function () {
    // Subscribe to 10 topics and send message
    const topicCount = 10;
    const td = generateTestData(topicCount, { pubsubTopic: TestPubsubTopic });
    const { error, subscription } = await waku.filter.subscribe(
      td.decoders,
      messageCollector.callback
    );
    if (error) {
      throw error;
    }
    for (let i = 0; i < topicCount; i++) {
      await waku.lightPush.send(td.encoders[i], {
        payload: utf8ToBytes(`M${i + 1}`)
      });
    }
    expect(await messageCollector.waitForMessages(10)).to.eq(true);

    // Unsubscribe from all topics and send again
    await subscription.unsubscribeAll();
    for (let i = 0; i < topicCount; i++) {
      await waku.lightPush.send(td.encoders[i], {
        payload: utf8ToBytes(`M${topicCount + i + 1}`)
      });
    }
    expect(await messageCollector.waitForMessages(11)).to.eq(false);

    // Check that from 20 messages send only 10 were received
    expect(messageCollector.count).to.eq(10);
    expect((await nwaku.messages()).length).to.eq(20);
  });
});

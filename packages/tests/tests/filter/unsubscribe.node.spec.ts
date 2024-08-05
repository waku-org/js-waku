import { createDecoder, createEncoder } from "@waku/core";
import { type LightNode } from "@waku/interfaces";
import { utf8ToBytes } from "@waku/sdk";
import { expect } from "chai";

import {
  afterEachCustom,
  beforeEachCustom,
  generateTestData,
  runMultipleNodes,
  ServiceNodesFleet,
  teardownNodesWithRedundancy
} from "../../src/index.js";

import {
  ClusterId,
  messagePayload,
  messageText,
  TestContentTopic,
  TestDecoder,
  TestEncoder,
  TestPubsubTopic
} from "./utils.js";

const runTests = (strictCheckNodes: boolean): void => {
  describe(`Waku Filter V2: Unsubscribe: Multiple Nodes: Strict Checking: ${strictCheckNodes}`, function () {
    // Set the timeout for all tests in this suite. Can be overwritten at test level
    this.timeout(10000);
    let waku: LightNode;
    let serviceNodes: ServiceNodesFleet;

    beforeEachCustom(this, async () => {
      [serviceNodes, waku] = await runMultipleNodes(this.ctx, {
        contentTopics: [TestContentTopic],
        clusterId: ClusterId
      });
    });

    afterEachCustom(this, async () => {
      await teardownNodesWithRedundancy(serviceNodes, waku);
    });

    it("Unsubscribe 1 topic - node subscribed to 1 topic", async function () {
      const { error, subscription } = await waku.filter.subscribe(
        [TestDecoder],
        serviceNodes.messageCollector.callback
      );
      if (error) {
        throw error;
      }
      await waku.lightPush.send(TestEncoder, messagePayload);
      expect(await serviceNodes.messageCollector.waitForMessages(1)).to.eq(
        true
      );

      // Unsubscribe from the topic and send again
      await subscription.unsubscribe([TestContentTopic]);
      await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M1") });
      expect(await serviceNodes.messageCollector.waitForMessages(2)).to.eq(
        false
      );

      // Check that from 2 messages send only the 1st was received
      serviceNodes.messageCollector.verifyReceivedMessage(0, {
        expectedMessageText: messageText,
        expectedContentTopic: TestContentTopic
      });
      expect(serviceNodes.messageCollector.count).to.eq(1);

      await serviceNodes.confirmMessageLength(2);
    });

    it("Unsubscribe 1 topic - node subscribed to 2 topics", async function () {
      // Subscribe to 2 topics and send messages
      const { error, subscription } = await waku.filter.subscribe(
        [TestDecoder],
        serviceNodes.messageCollector.callback
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
      await waku.filter.subscribe(
        [newDecoder],
        serviceNodes.messageCollector.callback
      );
      await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M1") });
      await waku.lightPush.send(newEncoder, { payload: utf8ToBytes("M2") });
      expect(await serviceNodes.messageCollector.waitForMessages(2)).to.eq(
        true
      );

      // Unsubscribe from the first topic and send again
      await subscription.unsubscribe([TestContentTopic]);
      await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M3") });
      await waku.lightPush.send(newEncoder, { payload: utf8ToBytes("M4") });
      expect(await serviceNodes.messageCollector.waitForMessages(3)).to.eq(
        true
      );

      // Check that from 4 messages send 3 were received
      expect(serviceNodes.messageCollector.count).to.eq(3);
      await serviceNodes.confirmMessageLength(4);
    });

    it("Unsubscribe 2 topics - node subscribed to 2 topics", async function () {
      // Subscribe to 2 topics and send messages
      await waku.filter.subscribe(
        [TestDecoder],
        serviceNodes.messageCollector.callback
      );
      const newContentTopic = "/test/2/waku-filter";
      const newEncoder = createEncoder({
        contentTopic: newContentTopic,
        pubsubTopic: TestPubsubTopic
      });
      const newDecoder = createDecoder(newContentTopic, TestPubsubTopic);
      const { error, subscription } = await waku.filter.subscribe(
        [newDecoder],
        serviceNodes.messageCollector.callback
      );
      if (error) {
        throw error;
      }
      await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M1") });
      await waku.lightPush.send(newEncoder, { payload: utf8ToBytes("M2") });
      expect(await serviceNodes.messageCollector.waitForMessages(2)).to.eq(
        true
      );

      // Unsubscribe from both and send again
      await subscription.unsubscribe([TestContentTopic, newContentTopic]);
      await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M3") });
      await waku.lightPush.send(newEncoder, { payload: utf8ToBytes("M4") });
      expect(await serviceNodes.messageCollector.waitForMessages(3)).to.eq(
        false
      );

      // Check that from 4 messages send 2 were received
      expect(serviceNodes.messageCollector.count).to.eq(2);
      await serviceNodes.confirmMessageLength(4);
    });

    it("Unsubscribe topics the node is not subscribed to", async function () {
      // Subscribe to 1 topic and send message
      const { error, subscription } = await waku.filter.subscribe(
        [TestDecoder],
        serviceNodes.messageCollector.callback
      );
      if (error) {
        throw error;
      }
      await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M1") });
      expect(await serviceNodes.messageCollector.waitForMessages(1)).to.eq(
        true
      );

      expect(serviceNodes.messageCollector.count).to.eq(1);

      // Unsubscribe from topics that the node is not not subscribed to and send again
      await subscription.unsubscribe([]);
      await subscription.unsubscribe(["/test/2/waku-filter"]);
      await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M2") });
      expect(await serviceNodes.messageCollector.waitForMessages(2)).to.eq(
        true
      );

      // Check that both messages were received
      expect(serviceNodes.messageCollector.count).to.eq(2);
      await serviceNodes.confirmMessageLength(2);
    });

    it("Unsubscribes all - node subscribed to 1 topic", async function () {
      const { error, subscription } = await waku.filter.subscribe(
        [TestDecoder],
        serviceNodes.messageCollector.callback
      );
      if (error) {
        throw error;
      }
      await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M1") });
      expect(await serviceNodes.messageCollector.waitForMessages(1)).to.eq(
        true
      );
      expect(serviceNodes.messageCollector.count).to.eq(1);

      // Unsubscribe from all topics and send again
      await subscription.unsubscribeAll();
      await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M2") });
      expect(await serviceNodes.messageCollector.waitForMessages(2)).to.eq(
        false
      );

      // Check that from 2 messages send only the 1st was received
      expect(serviceNodes.messageCollector.count).to.eq(1);
      await serviceNodes.confirmMessageLength(2);
    });

    it("Unsubscribes all - node subscribed to 10 topics", async function () {
      // Subscribe to 10 topics and send message
      const topicCount = 10;
      const td = generateTestData(topicCount, { pubsubTopic: TestPubsubTopic });
      const { error, subscription } = await waku.filter.subscribe(
        td.decoders,
        serviceNodes.messageCollector.callback
      );
      if (error) {
        throw error;
      }
      for (let i = 0; i < topicCount; i++) {
        await waku.lightPush.send(td.encoders[i], {
          payload: utf8ToBytes(`M${i + 1}`)
        });
      }
      expect(await serviceNodes.messageCollector.waitForMessages(10)).to.eq(
        true
      );

      // Unsubscribe from all topics and send again
      await subscription.unsubscribeAll();
      for (let i = 0; i < topicCount; i++) {
        await waku.lightPush.send(td.encoders[i], {
          payload: utf8ToBytes(`M${topicCount + i + 1}`)
        });
      }
      expect(await serviceNodes.messageCollector.waitForMessages(11)).to.eq(
        false
      );

      // Check that from 20 messages send only 10 were received
      expect(serviceNodes.messageCollector.count).to.eq(10);
      await serviceNodes.confirmMessageLength(20);
    });
  });
};

[true, false].map(runTests);

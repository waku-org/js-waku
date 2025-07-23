import { createDecoder, createEncoder } from "@waku/core";
import { type LightNode } from "@waku/interfaces";
import { utf8ToBytes } from "@waku/sdk";
import { createRoutingInfo } from "@waku/utils";
import { expect } from "chai";

import {
  afterEachCustom,
  beforeEachCustom,
  generateTestData,
  MessageCollector,
  runMultipleNodes,
  ServiceNodesFleet,
  teardownNodesWithRedundancy
} from "../../src/index.js";

import {
  messagePayload,
  messageText,
  TestContentTopic,
  TestDecoder,
  TestEncoder,
  TestNetworkConfig,
  TestRoutingInfo
} from "./utils.js";

const runTests = (strictCheckNodes: boolean): void => {
  describe(`Waku Filter: Unsubscribe: Multiple Nodes: Strict Checking: ${strictCheckNodes}`, function () {
    this.timeout(10000);
    let waku: LightNode;
    let serviceNodes: ServiceNodesFleet;

    beforeEachCustom(this, async () => {
      [serviceNodes, waku] = await runMultipleNodes(this.ctx, TestRoutingInfo, {
        filter: true,
        lightpush: true
      });
    });

    afterEachCustom(this, async () => {
      await teardownNodesWithRedundancy(serviceNodes, waku);
    });

    it("Unsubscribe 1 topic - node subscribed to 1 topic", async function () {
      // Create a separate message collector for the js-waku node
      const wakuMessageCollector = new MessageCollector();

      await waku.filter.subscribe(TestDecoder, wakuMessageCollector.callback);

      await waku.lightPush.send(TestEncoder, messagePayload);
      expect(await wakuMessageCollector.waitForMessages(1)).to.eq(true);
      await waku.filter.unsubscribe(TestDecoder);

      const messageCountAfterUnsubscribe = wakuMessageCollector.count;

      await waku.lightPush.send(TestEncoder, messagePayload);

      await new Promise((resolve) => setTimeout(resolve, 1000));

      expect(wakuMessageCollector.count).to.eq(messageCountAfterUnsubscribe);

      wakuMessageCollector.verifyReceivedMessage(0, {
        expectedMessageText: messageText,
        expectedContentTopic: TestContentTopic
      });

      expect(wakuMessageCollector.count).to.be.at.least(1);
    });

    it("Unsubscribe 1 topic - node subscribed to 2 topics", async function () {
      const wakuMessageCollector = new MessageCollector();

      await waku.filter.subscribe(TestDecoder, wakuMessageCollector.callback);

      const newContentTopic = "/test/2/waku-filter/proto";
      const newRoutingInfo = createRoutingInfo(TestNetworkConfig, {
        contentTopic: newContentTopic
      });
      const newEncoder = createEncoder({
        contentTopic: newContentTopic,
        routingInfo: newRoutingInfo
      });
      const newDecoder = createDecoder(newContentTopic, newRoutingInfo);
      await waku.filter.subscribe(newDecoder, wakuMessageCollector.callback);
      await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M1") });
      await waku.lightPush.send(newEncoder, { payload: utf8ToBytes("M2") });
      expect(await wakuMessageCollector.waitForMessages(3)).to.eq(true);

      await waku.filter.unsubscribe(TestDecoder);

      await new Promise((resolve) => setTimeout(resolve, 1500));

      const messageCountAfterUnsubscribe = wakuMessageCollector.count;

      await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M3") });
      await waku.lightPush.send(newEncoder, { payload: utf8ToBytes("M4") });

      await new Promise((resolve) => setTimeout(resolve, 1000));

      expect(wakuMessageCollector.count).to.eq(
        messageCountAfterUnsubscribe + 2
      );

      const hasM3 = wakuMessageCollector.hasMessage(newContentTopic, "M3");
      const hasM4 = wakuMessageCollector.hasMessage(newContentTopic, "M4");
      expect(hasM3).to.eq(false);
      expect(hasM4).to.eq(true);
    });

    it("Unsubscribe 2 topics - node subscribed to 2 topics", async function () {
      const wakuMessageCollector = new MessageCollector();

      await waku.filter.subscribe(TestDecoder, wakuMessageCollector.callback);
      const newContentTopic = "/test/2/waku-filter/proto";
      const newRoutingInfo = createRoutingInfo(TestNetworkConfig, {
        contentTopic: newContentTopic
      });
      const newEncoder = createEncoder({
        contentTopic: newContentTopic,
        routingInfo: newRoutingInfo
      });
      const newDecoder = createDecoder(newContentTopic, newRoutingInfo);
      await waku.filter.subscribe(newDecoder, wakuMessageCollector.callback);

      await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M1") });
      await waku.lightPush.send(newEncoder, { payload: utf8ToBytes("M2") });

      await new Promise((resolve) => setTimeout(resolve, 2000));

      expect(wakuMessageCollector.count).to.be.at.least(3);

      const hasM1 = wakuMessageCollector.hasMessage(TestContentTopic, "M1");
      const hasM2 = wakuMessageCollector.hasMessage(newContentTopic, "M2");
      expect(hasM1).to.eq(true);
      expect(hasM2).to.eq(true);

      await waku.filter.unsubscribe(TestDecoder);
      await waku.filter.unsubscribe(newDecoder);

      await new Promise((resolve) => setTimeout(resolve, 1500));

      const messageCountAfterUnsubscribe = wakuMessageCollector.count;

      await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M3") });
      await waku.lightPush.send(newEncoder, { payload: utf8ToBytes("M4") });

      await new Promise((resolve) => setTimeout(resolve, 1000));

      expect(wakuMessageCollector.count).to.eq(messageCountAfterUnsubscribe);

      expect(wakuMessageCollector.count).to.be.at.least(3);
    });

    it("Unsubscribe topics the node is not subscribed to", async function () {
      await waku.filter.subscribe(
        TestDecoder,
        serviceNodes.messageCollector.callback
      );

      await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M1") });
      expect(await serviceNodes.messageCollector.waitForMessages(2)).to.eq(
        true
      );

      expect(serviceNodes.messageCollector.count).to.eq(2);

      await waku.filter.unsubscribe(
        createDecoder(
          "/test/2/waku-filter/proto",
          createRoutingInfo(TestNetworkConfig, {
            contentTopic: "/test/2/waku-filter/proto"
          })
        )
      );
      await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M2") });
      expect(await serviceNodes.messageCollector.waitForMessages(3)).to.eq(
        true
      );

      expect(serviceNodes.messageCollector.count).to.be.at.least(3);
      expect(serviceNodes.messageCollector.count).to.be.at.least(3);
    });

    it("Unsubscribe from 100 topics (new limit) at once and receives messages", async function () {
      this.timeout(100_000);
      const topicCount = 100;
      const td = generateTestData(topicCount, TestNetworkConfig);

      await waku.filter.subscribe(
        td.decoders,
        serviceNodes.messageCollector.callback
      );

      for (let i = 0; i < topicCount; i++) {
        await waku.lightPush.send(td.encoders[i], {
          payload: utf8ToBytes(`Message for Topic ${i + 1}`)
        });
      }

      const expectedMinMessages = Math.floor(topicCount * 1.9); // Allow for 10% loss
      const waitResult =
        await serviceNodes.messageCollector.waitForMessages(
          expectedMinMessages
        );
      expect(waitResult).to.eq(true);
      td.contentTopics.forEach((topic, index) => {
        serviceNodes.messageCollector.verifyReceivedMessage(index, {
          expectedContentTopic: topic,
          expectedMessageText: `Message for Topic ${index + 1}`,
          expectedPubsubTopic: TestRoutingInfo.pubsubTopic
        });
      });

      await waku.filter.unsubscribe(td.decoders);

      for (let i = 0; i < topicCount; i++) {
        await waku.lightPush.send(td.encoders[i], {
          payload: utf8ToBytes(`Message for Topic ${i + 1}`)
        });
      }

      expect(serviceNodes.messageCollector.count).to.be.at.least(
        Math.floor(topicCount * 1.9)
      );
    });
  });
};

[true, false].map(runTests);

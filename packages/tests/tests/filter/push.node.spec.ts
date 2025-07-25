import { LightNode, Protocols } from "@waku/interfaces";
import { utf8ToBytes } from "@waku/sdk";
import { createRoutingInfo } from "@waku/utils";
import { expect } from "chai";

import {
  afterEachCustom,
  beforeEachCustom,
  delay,
  runMultipleNodes,
  ServiceNodesFleet,
  teardownNodesWithRedundancy,
  TEST_STRING,
  TEST_TIMESTAMPS
} from "../../src/index.js";

import {
  messageText,
  TestContentTopic,
  TestDecoder,
  TestEncoder,
  TestRoutingInfo
} from "./utils.js";

const runTests = (strictCheckNodes: boolean): void => {
  describe(`Waku Filter: FilterPush: Multiple Nodes: Strict Checking: ${strictCheckNodes}`, function () {
    // Set the timeout for all tests in this suite. Can be overwritten at test level
    this.timeout(10000);
    let waku: LightNode;
    let serviceNodes: ServiceNodesFleet;
    let ctx: Mocha.Context;

    beforeEachCustom(this, async () => {
      ctx = this.ctx;
      [serviceNodes, waku] = await runMultipleNodes(this.ctx, TestRoutingInfo, {
        lightpush: true,
        filter: true
      });
    });

    afterEachCustom(this, async () => {
      await teardownNodesWithRedundancy(serviceNodes, waku);
    });

    TEST_STRING.forEach((testItem) => {
      it(`Check received message containing ${testItem.description}`, async function () {
        await waku.filter.subscribe(
          TestDecoder,
          serviceNodes.messageCollector.callback
        );

        await waku.lightPush.send(TestEncoder, {
          payload: utf8ToBytes(testItem.value)
        });

        expect(await serviceNodes.messageCollector.waitForMessages(1)).to.eq(
          true
        );
        serviceNodes.messageCollector.verifyReceivedMessage(0, {
          expectedMessageText: testItem.value,
          expectedContentTopic: TestContentTopic,
          expectedPubsubTopic: TestRoutingInfo.pubsubTopic
        });
      });
    });

    TEST_TIMESTAMPS.forEach((testItem) => {
      it(`Check received message with timestamp: ${testItem} `, async function () {
        await waku.filter.subscribe(
          TestDecoder,
          serviceNodes.messageCollector.callback
        );
        await delay(400);

        await serviceNodes.sendRelayMessage(
          {
            contentTopic: TestContentTopic,
            payload: Buffer.from(utf8ToBytes(messageText)).toString("base64"),
            timestamp: testItem as any
          },
          TestRoutingInfo
        );

        expect(await serviceNodes.messageCollector.waitForMessages(1)).to.eq(
          true
        );
        serviceNodes.messageCollector.verifyReceivedMessage(0, {
          expectedMessageText: messageText,
          checkTimestamp: false,
          expectedContentTopic: TestContentTopic,
          expectedPubsubTopic: TestRoutingInfo.pubsubTopic
        });

        // Check if the timestamp matches
        const timestamp = serviceNodes.messageCollector.getMessage(0).timestamp;
        if (testItem == undefined) {
          expect(timestamp).to.eq(undefined);
        }
        if (timestamp !== undefined && timestamp instanceof Date) {
          expect(testItem?.toString()).to.contain(
            timestamp.getTime().toString()
          );
        }
      });
    });

    it("Check message with invalid timestamp is not received", async function () {
      await waku.filter.subscribe(
        TestDecoder,
        serviceNodes.messageCollector.callback
      );
      await delay(400);

      await serviceNodes.sendRelayMessage(
        {
          contentTopic: TestContentTopic,
          payload: Buffer.from(utf8ToBytes(messageText)).toString("base64"),
          timestamp: "2023-09-06T12:05:38.609Z" as any
        },
        TestRoutingInfo
      );

      // Verify that no message was received
      expect(await serviceNodes.messageCollector.waitForMessages(1)).to.eq(
        false
      );
    });

    it("Check message on other pubsub topic is not received", async function () {
      await waku.filter.subscribe(
        TestDecoder,
        serviceNodes.messageCollector.callback
      );
      await delay(400);

      const wrongContentTopic = "/wrong/1/ContentTopic/proto";
      await serviceNodes.sendRelayMessage(
        {
          contentTopic: wrongContentTopic,
          payload: Buffer.from(utf8ToBytes(messageText)).toString("base64"),
          timestamp: BigInt(Date.now()) * BigInt(1000000)
        },
        createRoutingInfo(TestRoutingInfo.networkConfig, {
          contentTopic: "/wrong/1/ContentTopic/proto"
        })
      );

      expect(await serviceNodes.messageCollector.waitForMessages(1)).to.eq(
        false
      );
    });

    it("Check message with no pubsub topic is not received", async function () {
      await waku.filter.subscribe(
        TestDecoder,
        serviceNodes.messageCollector.callback
      );
      await delay(400);

      await serviceNodes.nodes[0].restCall<boolean>(
        `/relay/v1/messages/`,
        "POST",
        {
          contentTopic: TestContentTopic,
          payload: Buffer.from(utf8ToBytes(messageText)).toString("base64"),
          timestamp: BigInt(Date.now()) * BigInt(1000000)
        },
        async (res) => res.status === 200
      );

      expect(await serviceNodes.messageCollector.waitForMessages(1)).to.eq(
        false
      );
    });

    it("Check message with no content topic is not received", async function () {
      await waku.filter.subscribe(
        TestDecoder,
        serviceNodes.messageCollector.callback
      );
      await delay(400);

      await serviceNodes.sendRelayMessage(
        {
          payload: Buffer.from(utf8ToBytes(messageText)).toString("base64"),
          timestamp: BigInt(Date.now()) * BigInt(1000000)
        },
        TestRoutingInfo
      );

      expect(await serviceNodes.messageCollector.waitForMessages(1)).to.eq(
        false
      );
    });

    it("Check message with no payload is not received", async function () {
      await waku.filter.subscribe(
        TestDecoder,
        serviceNodes.messageCollector.callback
      );
      await delay(400);

      await serviceNodes.sendRelayMessage(
        {
          contentTopic: TestContentTopic,
          timestamp: BigInt(Date.now()) * BigInt(1000000),
          payload: undefined as any
        },
        TestRoutingInfo
      );

      expect(await serviceNodes.messageCollector.waitForMessages(1)).to.eq(
        false
      );
    });

    it("Check message with non string payload is not received", async function () {
      await waku.filter.subscribe(
        TestDecoder,
        serviceNodes.messageCollector.callback
      );
      await delay(400);

      await serviceNodes.sendRelayMessage(
        {
          contentTopic: TestContentTopic,
          payload: 12345 as unknown as string,
          timestamp: BigInt(Date.now()) * BigInt(1000000)
        },
        TestRoutingInfo
      );

      expect(await serviceNodes.messageCollector.waitForMessages(1)).to.eq(
        false
      );
    });

    it("Check message received after jswaku node is restarted", async function () {
      await waku.filter.subscribe(
        TestDecoder,
        serviceNodes.messageCollector.callback
      );
      await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M1") });
      expect(await serviceNodes.messageCollector.waitForMessages(1)).to.eq(
        true
      );

      await waku.stop();
      expect(waku.isStarted()).to.eq(false);
      await waku.start();
      expect(waku.isStarted()).to.eq(true);

      for (const node of serviceNodes.nodes) {
        await waku.dial(await node.getMultiaddrWithId());
        await waku.waitForPeers([Protocols.Filter, Protocols.LightPush]);
      }

      await waku.filter.subscribe(
        TestDecoder,
        serviceNodes.messageCollector.callback
      );

      await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M2") });

      expect(await serviceNodes.messageCollector.waitForMessages(2)).to.eq(
        true
      );
      serviceNodes.messageCollector.verifyReceivedMessage(0, {
        expectedMessageText: "M1",
        expectedContentTopic: TestContentTopic,
        expectedPubsubTopic: TestRoutingInfo.pubsubTopic
      });
      serviceNodes.messageCollector.verifyReceivedMessage(1, {
        expectedMessageText: "M2",
        expectedContentTopic: TestContentTopic,
        expectedPubsubTopic: TestRoutingInfo.pubsubTopic
      });
    });

    it("Check message received after old nwaku nodes are not available and new are created", async function () {
      let callback = serviceNodes.messageCollector.callback;

      await waku.filter.subscribe(TestDecoder, (...args) => callback(...args));

      await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M1") });

      expect(await serviceNodes.messageCollector.waitForMessages(1)).to.eq(
        true
      );
      serviceNodes.messageCollector.verifyReceivedMessage(0, {
        expectedMessageText: "M1",
        expectedContentTopic: TestContentTopic,
        expectedPubsubTopic: TestRoutingInfo.pubsubTopic
      });

      await teardownNodesWithRedundancy(serviceNodes, []);
      serviceNodes = await ServiceNodesFleet.createAndRun(
        ctx,
        2,
        false,
        TestRoutingInfo,
        {
          lightpush: true,
          filter: true,
          peerExchange: true
        },
        false
      );

      callback = serviceNodes.messageCollector.callback;

      let cnt = 0;
      const peerConnectEvent = new Promise((resolve, reject) => {
        waku.libp2p.addEventListener("peer:connect", (e) => {
          cnt += 1;
          if (cnt === 2) {
            resolve(e);
          }
        });
        setTimeout(() => reject, 1000);
      });

      for (const node of serviceNodes.nodes) {
        await waku.dial(await node.getMultiaddrWithId());
        await waku.waitForPeers([Protocols.Filter, Protocols.LightPush]);
      }

      await peerConnectEvent;

      await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M2") });

      expect(await serviceNodes.messageCollector.waitForMessages(1)).to.eq(
        true
      );
      serviceNodes.messageCollector.verifyReceivedMessage(1, {
        expectedMessageText: "M2",
        expectedContentTopic: TestContentTopic,
        expectedPubsubTopic: TestRoutingInfo.pubsubTopic
      });
    });
  });
};

[true, false].map(runTests);

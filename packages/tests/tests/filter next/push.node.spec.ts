import { LightNode, Protocols } from "@waku/interfaces";
import { utf8ToBytes } from "@waku/sdk";
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
  TestPubsubTopic,
  TestShardInfo
} from "./utils.js";

const runTests = (strictCheckNodes: boolean): void => {
  describe(`Waku Filter Next: FilterPush: Multiple Nodes: Strict Checking: ${strictCheckNodes}`, function () {
    // Set the timeout for all tests in this suite. Can be overwritten at test level
    this.timeout(10000);
    let waku: LightNode;
    let serviceNodes: ServiceNodesFleet;

    beforeEachCustom(this, async () => {
      [serviceNodes, waku] = await runMultipleNodes(this.ctx, TestShardInfo, {
        lightpush: true,
        filter: true
      });
    });

    afterEachCustom(this, async () => {
      await teardownNodesWithRedundancy(serviceNodes, waku);
    });

    TEST_STRING.forEach((testItem) => {
      it(`Check received message containing ${testItem.description}`, async function () {
        await waku.nextFilter.subscribe(
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
          expectedPubsubTopic: TestPubsubTopic
        });
      });
    });

    TEST_TIMESTAMPS.forEach((testItem) => {
      it(`Check received message with timestamp: ${testItem} `, async function () {
        await waku.nextFilter.subscribe(
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
          TestPubsubTopic
        );

        expect(await serviceNodes.messageCollector.waitForMessages(1)).to.eq(
          true
        );
        serviceNodes.messageCollector.verifyReceivedMessage(0, {
          expectedMessageText: messageText,
          checkTimestamp: false,
          expectedContentTopic: TestContentTopic,
          expectedPubsubTopic: TestPubsubTopic
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
      await waku.nextFilter.subscribe(
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
        TestPubsubTopic
      );

      // Verify that no message was received
      expect(await serviceNodes.messageCollector.waitForMessages(1)).to.eq(
        false
      );
    });

    it("Check message on other pubsub topic is not received", async function () {
      await waku.nextFilter.subscribe(
        TestDecoder,
        serviceNodes.messageCollector.callback
      );
      await delay(400);

      await serviceNodes.sendRelayMessage(
        {
          contentTopic: TestContentTopic,
          payload: Buffer.from(utf8ToBytes(messageText)).toString("base64"),
          timestamp: BigInt(Date.now()) * BigInt(1000000)
        },
        "WrongContentTopic"
      );

      expect(
        await serviceNodes.messageCollector.waitForMessages(1, {
          pubsubTopic: TestPubsubTopic
        })
      ).to.eq(false);
    });

    it("Check message with no pubsub topic is not received", async function () {
      await waku.nextFilter.subscribe(
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
      await waku.nextFilter.subscribe(
        TestDecoder,
        serviceNodes.messageCollector.callback
      );
      await delay(400);

      await serviceNodes.sendRelayMessage(
        {
          payload: Buffer.from(utf8ToBytes(messageText)).toString("base64"),
          timestamp: BigInt(Date.now()) * BigInt(1000000)
        },
        TestPubsubTopic
      );

      expect(await serviceNodes.messageCollector.waitForMessages(1)).to.eq(
        false
      );
    });

    it("Check message with no payload is not received", async function () {
      await waku.nextFilter.subscribe(
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
        TestPubsubTopic
      );

      expect(await serviceNodes.messageCollector.waitForMessages(1)).to.eq(
        false
      );
    });

    it("Check message with non string payload is not received", async function () {
      await waku.nextFilter.subscribe(
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
        TestPubsubTopic
      );

      expect(await serviceNodes.messageCollector.waitForMessages(1)).to.eq(
        false
      );
    });

    it("Check message received after jswaku node is restarted", async function () {
      await waku.nextFilter.subscribe(
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

      await waku.nextFilter.subscribe(
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
        expectedPubsubTopic: TestPubsubTopic
      });
      serviceNodes.messageCollector.verifyReceivedMessage(1, {
        expectedMessageText: "M2",
        expectedContentTopic: TestContentTopic,
        expectedPubsubTopic: TestPubsubTopic
      });
    });

    it("Check message received after nwaku node is restarted", async function () {
      await waku.nextFilter.subscribe(
        TestDecoder,
        serviceNodes.messageCollector.callback
      );
      await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M1") });
      expect(await serviceNodes.messageCollector.waitForMessages(1)).to.eq(
        true
      );

      await teardownNodesWithRedundancy(serviceNodes, []);
      await serviceNodes.start();

      for (const node of serviceNodes.nodes) {
        await waku.dial(await node.getMultiaddrWithId());
        await waku.waitForPeers([Protocols.Filter, Protocols.LightPush]);
      }

      await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M2") });

      expect(await serviceNodes.messageCollector.waitForMessages(2)).to.eq(
        true
      );
      serviceNodes.messageCollector.verifyReceivedMessage(0, {
        expectedMessageText: "M1",
        expectedContentTopic: TestContentTopic,
        expectedPubsubTopic: TestPubsubTopic
      });
      serviceNodes.messageCollector.verifyReceivedMessage(1, {
        expectedMessageText: "M2",
        expectedContentTopic: TestContentTopic,
        expectedPubsubTopic: TestPubsubTopic
      });
    });
  });
};

[true, false].map(runTests);

import { LightNode, Protocols } from "@waku/interfaces";
import { utf8ToBytes } from "@waku/sdk";
import { expect } from "chai";

import {
  ServiceNodesFleet,
  TEST_STRING,
  TEST_TIMESTAMPS
} from "../../src/index.js";

import {
  messageText,
  OptimizedFilterTestContext,
  sendMessagesInParallel,
  shouldRunStrictMode,
  TestContentTopic,
  TestDecoder,
  TestEncoder,
  TestPubsubTopic,
  TestShardInfo,
  waitForSubscriptionReady
} from "./optimized-utils.js";

// Run tests based on environment configuration
const strictModes = shouldRunStrictMode() ? [true, false] : [false];

strictModes.forEach((strictCheckNodes) => {
  describe(`Waku Filter Next: Optimized FilterPush: Strict: ${strictCheckNodes}`, function () {
    this.timeout(60000);
    let waku: LightNode;
    let serviceNodes: ServiceNodesFleet;
    let testContext: OptimizedFilterTestContext;

    // Use shared context for all tests in this suite
    before(async function () {
      this.timeout(120000);
      testContext = await OptimizedFilterTestContext.getInstance(
        this,
        TestShardInfo,
        strictCheckNodes,
        2
      );
    });

    after(async function () {
      await testContext.cleanup();
    });

    beforeEach(async function () {
      // Reset state instead of recreating
      [serviceNodes, waku] = await testContext.resetForTest();
    });

    // Batch all TEST_STRING tests into one
    it("Check received messages for all test strings", async function () {
      await waku.nextFilter.subscribe(
        TestDecoder,
        serviceNodes.messageCollector.callback
      );

      // Wait for subscription to be ready
      await waitForSubscriptionReady(waku.nextFilter);

      // Send all test messages in parallel
      const messages = TEST_STRING.map((testItem, index) => ({
        encoder: TestEncoder,
        payload: utf8ToBytes(`${index}:${testItem.value}`)
      }));

      await sendMessagesInParallel(waku, messages);

      // Verify all messages received
      expect(
        await serviceNodes.messageCollector.waitForMessages(
          TEST_STRING.length,
          { timeoutDuration: 200 } // Reduced timeout per message
        )
      ).to.eq(true);

      // Verify each message
      TEST_STRING.forEach((testItem, index) => {
        const msg = serviceNodes.messageCollector.getMessage(index);
        const received = utf8ToBytes(msg.payload);
        expect(received).to.include(testItem.value);
      });
    });

    // Batch timestamp tests
    it("Check received messages with various timestamps", async function () {
      await waku.nextFilter.subscribe(
        TestDecoder,
        serviceNodes.messageCollector.callback
      );

      await waitForSubscriptionReady(waku.nextFilter);

      // Send messages with different timestamps in parallel
      const timestampPromises = TEST_TIMESTAMPS.map((timestamp) =>
        serviceNodes.sendRelayMessage(
          {
            contentTopic: TestContentTopic,
            payload: Buffer.from(utf8ToBytes(messageText)).toString("base64"),
            timestamp: timestamp as any
          },
          TestPubsubTopic
        )
      );

      await Promise.all(timestampPromises);

      expect(
        await serviceNodes.messageCollector.waitForMessages(
          TEST_TIMESTAMPS.length,
          { timeoutDuration: 200 }
        )
      ).to.eq(true);

      // Verify timestamps
      TEST_TIMESTAMPS.forEach((expectedTimestamp, index) => {
        const msg = serviceNodes.messageCollector.getMessage(index);
        if (expectedTimestamp === undefined) {
          expect(msg.timestamp).to.eq(undefined);
        } else if (msg.timestamp !== undefined) {
          expect(msg.timestamp.getTime()).to.be.closeTo(
            Number(expectedTimestamp),
            10000
          );
        }
      });
    });

    // Keep critical individual tests
    it("Check message with invalid timestamp is not received", async function () {
      await waku.nextFilter.subscribe(
        TestDecoder,
        serviceNodes.messageCollector.callback
      );

      await waitForSubscriptionReady(waku.nextFilter);

      await serviceNodes.sendRelayMessage(
        {
          contentTopic: TestContentTopic,
          payload: Buffer.from(utf8ToBytes("invalid timestamp")).toString(
            "base64"
          ),
          timestamp: "invalid" as any
        },
        TestPubsubTopic
      );

      await serviceNodes.sendRelayMessage(
        {
          contentTopic: TestContentTopic,
          payload: Buffer.from(utf8ToBytes("valid message")).toString("base64"),
          timestamp: BigInt(Date.now()) * BigInt(1000000)
        },
        TestPubsubTopic
      );

      expect(await serviceNodes.messageCollector.waitForMessages(1)).to.eq(
        false
      );
    });

    it("Check message received after jswaku node restart", async function () {
      await waku.nextFilter.subscribe(
        TestDecoder,
        serviceNodes.messageCollector.callback
      );

      await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M1") });
      expect(await serviceNodes.messageCollector.waitForMessages(1)).to.eq(
        true
      );

      // Restart waku node
      await waku.stop();
      expect(waku.isStarted()).to.eq(false);
      await waku.start();
      expect(waku.isStarted()).to.eq(true);

      // Reconnect in parallel
      const reconnectPromises = serviceNodes.nodes.map(async (node) => {
        await waku.dial(await node.getMultiaddrWithId());
      });
      await Promise.all(reconnectPromises);
      await waku.waitForPeers([Protocols.Filter, Protocols.LightPush]);

      await waku.nextFilter.subscribe(
        TestDecoder,
        serviceNodes.messageCollector.callback
      );

      await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M2") });

      expect(await serviceNodes.messageCollector.waitForMessages(1)).to.eq(
        true
      );
      serviceNodes.messageCollector.verifyReceivedMessage(1, {
        expectedMessageText: "M2",
        expectedContentTopic: TestContentTopic,
        expectedPubsubTopic: TestPubsubTopic
      });
    });
  });
});

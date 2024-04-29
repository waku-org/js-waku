import { waitForRemotePeer } from "@waku/core";
import { ISubscriptionSDK, LightNode, Protocols } from "@waku/interfaces";
import { utf8ToBytes } from "@waku/sdk";
import { expect } from "chai";

import {
  afterEachCustom,
  beforeEachCustom,
  delay,
  ServiceNodesFleet,
  TEST_STRING,
  TEST_TIMESTAMPS
} from "../../src/index.js";

import {
  messageText,
  runMultipleNodes,
  teardownNodesWithRedundancy,
  TestContentTopic,
  TestDecoder,
  TestEncoder,
  TestPubsubTopic,
  TestShardInfo
} from "./utils.js";

const runTests = (strictCheckNodes: boolean): void => {
  describe(`Waku Filter V2: FilterPush: Multiple Nodes: Strict Checking: ${strictCheckNodes}`, function () {
    // Set the timeout for all tests in this suite. Can be overwritten at test level
    this.timeout(10000);
    let waku: LightNode;
    let serviceNodes: ServiceNodesFleet;
    let subscription: ISubscriptionSDK;

    beforeEachCustom(this, async () => {
      [serviceNodes, waku] = await runMultipleNodes(this.ctx, TestShardInfo);

      const { error, subscription: _subscription } =
        await waku.filter.createSubscription(TestShardInfo);
      if (!error) subscription = _subscription;
    });

    afterEachCustom(this, async () => {
      await teardownNodesWithRedundancy(serviceNodes, waku);
    });

    TEST_STRING.forEach((testItem) => {
      it(`Check received message containing ${testItem.description}`, async function () {
        await subscription.subscribe(
          [TestDecoder],
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
        await subscription.subscribe(
          [TestDecoder],
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
      await subscription.subscribe(
        [TestDecoder],
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
      await subscription.subscribe(
        [TestDecoder],
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

    it("Check message with no content topic is not received", async function () {
      await subscription.subscribe(
        [TestDecoder],
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
      await subscription.subscribe(
        [TestDecoder],
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

      // For go-waku the message is received (it is possible to send a message with no payload)
      if (serviceNodes.type == "go-waku") {
        expect(await serviceNodes.messageCollector.waitForMessages(1)).to.eq(
          true
        );
      } else {
        expect(await serviceNodes.messageCollector.waitForMessages(1)).to.eq(
          false
        );
      }
    });

    it("Check message with non string payload is not received", async function () {
      await subscription.subscribe(
        [TestDecoder],
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

    // Will be skipped until https://github.com/waku-org/js-waku/issues/1464 si done
    it.skip("Check message received after jswaku node is restarted", async function () {
      // Subscribe and send message
      await subscription.subscribe(
        [TestDecoder],
        serviceNodes.messageCollector.callback
      );
      await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M1") });
      expect(await serviceNodes.messageCollector.waitForMessages(1)).to.eq(
        true
      );

      // Restart js-waku node
      await waku.stop();
      expect(waku.isStarted()).to.eq(false);
      await waku.start();
      expect(waku.isStarted()).to.eq(true);

      // Redo the connection and create a new subscription
      for (const node of this.serviceNodes) {
        await waku.dial(await node.getMultiaddrWithId());
        await waitForRemotePeer(waku, [Protocols.Filter, Protocols.LightPush]);
      }
      const { error, subscription: _subscription } =
        await waku.filter.createSubscription(TestShardInfo);
      if (!error) subscription = _subscription;
      await subscription.subscribe(
        [TestDecoder],
        serviceNodes.messageCollector.callback
      );

      await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M2") });

      // Confirm both messages were received.
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

    // Will be skipped until https://github.com/waku-org/js-waku/issues/1464 si done
    it.skip("Check message received after nwaku node is restarted", async function () {
      await subscription.subscribe(
        [TestDecoder],
        serviceNodes.messageCollector.callback
      );
      await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M1") });
      expect(await serviceNodes.messageCollector.waitForMessages(1)).to.eq(
        true
      );

      // Restart nwaku node
      await teardownNodesWithRedundancy(serviceNodes, []);
      await serviceNodes.start();
      await waitForRemotePeer(waku, [Protocols.Filter, Protocols.LightPush]);

      await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M2") });

      // Confirm both messages were received.
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

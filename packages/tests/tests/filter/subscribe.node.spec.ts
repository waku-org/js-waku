import { createDecoder, createEncoder } from "@waku/core";
import {
  DefaultPubsubTopic,
  IFilterSubscription,
  LightNode
} from "@waku/interfaces";
import {
  ecies,
  generatePrivateKey,
  generateSymmetricKey,
  getPublicKey,
  symmetric
} from "@waku/message-encryption";
import { utf8ToBytes } from "@waku/sdk";
import { expect } from "chai";

import {
  delay,
  generateTestData,
  ServiceNodes,
  TEST_STRING
} from "../../src/index.js";

import {
  messagePayload,
  messageText,
  runMultipleNodes,
  teardownNodesWithRedundancy,
  TestContentTopic,
  TestDecoder,
  TestEncoder
} from "./utils.js";

const runTests = (strictCheckNodes: boolean): void => {
  describe(`Waku Filter V2: Subscribe: Multiple Service Nodes: Strict Check mode: ${strictCheckNodes}`, function () {
    this.timeout(100000);
    let waku: LightNode;
    let serviceNodes: ServiceNodes;
    let subscription: IFilterSubscription;

    this.beforeEach(async function () {
      this.timeout(15000);
      [serviceNodes, waku] = await runMultipleNodes(
        this,
        [DefaultPubsubTopic],
        strictCheckNodes
      );
      subscription = await waku.filter.createSubscription();
    });

    this.afterEach(async function () {
      this.timeout(15000);
      await teardownNodesWithRedundancy(serviceNodes, waku);
    });

    it("Subscribe and receive messages via lightPush", async function () {
      expect(waku.libp2p.getConnections()).has.length(3);

      await subscription.subscribe(
        [TestDecoder],
        serviceNodes.messageCollector.callback
      );

      await waku.lightPush.send(TestEncoder, messagePayload);

      expect(await serviceNodes.messageCollector.waitForMessages(1)).to.eq(
        true
      );
      serviceNodes.messageCollector.verifyReceivedMessage(0, {
        expectedMessageText: messageText,
        expectedContentTopic: TestContentTopic
      });

      await serviceNodes.confirmMessageLength(1);
    });

    it("Subscribe and receive ecies encrypted messages via lightPush", async function () {
      const privateKey = generatePrivateKey();
      const publicKey = getPublicKey(privateKey);
      const encoder = ecies.createEncoder({
        contentTopic: TestContentTopic,
        publicKey
      });
      const decoder = ecies.createDecoder(TestContentTopic, privateKey);

      await subscription.subscribe(
        [decoder],
        serviceNodes.messageCollector.callback
      );

      await waku.lightPush.send(encoder, messagePayload);

      expect(await serviceNodes.messageCollector.waitForMessages(1)).to.eq(
        true
      );
      serviceNodes.messageCollector.verifyReceivedMessage(0, {
        expectedMessageText: messageText,
        expectedContentTopic: TestContentTopic,
        expectedVersion: 1
      });

      await serviceNodes.confirmMessageLength(1);
    });

    it("Subscribe and receive symmetrically encrypted messages via lightPush", async function () {
      const symKey = generateSymmetricKey();
      const encoder = symmetric.createEncoder({
        contentTopic: TestContentTopic,
        symKey
      });
      const decoder = symmetric.createDecoder(TestContentTopic, symKey);

      await subscription.subscribe(
        [decoder],
        serviceNodes.messageCollector.callback
      );

      await waku.lightPush.send(encoder, messagePayload);

      expect(await serviceNodes.messageCollector.waitForMessages(1)).to.eq(
        true
      );
      serviceNodes.messageCollector.verifyReceivedMessage(0, {
        expectedMessageText: messageText,
        expectedContentTopic: TestContentTopic,
        expectedVersion: 1
      });

      await serviceNodes.confirmMessageLength(1);
    });

    it("Subscribe and receive messages via waku relay post", async function () {
      await subscription.subscribe(
        [TestDecoder],
        serviceNodes.messageCollector.callback
      );

      await delay(400);

      // Send a test message using the relay post method.
      const relayMessage = ServiceNodes.toMessageRpcQuery({
        contentTopic: TestContentTopic,
        payload: utf8ToBytes(messageText)
      });
      await serviceNodes.sendRelayMessage(relayMessage);

      expect(await serviceNodes.messageCollector.waitForMessages(1)).to.eq(
        true
      );
      serviceNodes.messageCollector.verifyReceivedMessage(0, {
        expectedMessageText: messageText,
        expectedContentTopic: TestContentTopic
      });

      await serviceNodes.confirmMessageLength(1);
    });

    it("Subscribe and receive 2 messages on the same topic", async function () {
      await subscription.subscribe(
        [TestDecoder],
        serviceNodes.messageCollector.callback
      );

      await waku.lightPush.send(TestEncoder, messagePayload);

      expect(await serviceNodes.messageCollector.waitForMessages(1)).to.eq(
        true
      );
      serviceNodes.messageCollector.verifyReceivedMessage(0, {
        expectedMessageText: messageText,
        expectedContentTopic: TestContentTopic
      });

      // Send another message on the same topic.
      const newMessageText = "Filtering still works!";
      await waku.lightPush.send(TestEncoder, {
        payload: utf8ToBytes(newMessageText)
      });

      // Verify that the second message was successfully received.
      expect(await serviceNodes.messageCollector.waitForMessages(2)).to.eq(
        true
      );
      serviceNodes.messageCollector.verifyReceivedMessage(1, {
        expectedMessageText: newMessageText,
        expectedContentTopic: TestContentTopic
      });

      await serviceNodes.confirmMessageLength(2);
    });

    it("Subscribe and receive messages on 2 different content topics", async function () {
      // Subscribe to the first content topic and send a message.
      await subscription.subscribe(
        [TestDecoder],
        serviceNodes.messageCollector.callback
      );
      await waku.lightPush.send(TestEncoder, messagePayload);
      expect(await serviceNodes.messageCollector.waitForMessages(1)).to.eq(
        true
      );
      serviceNodes.messageCollector.verifyReceivedMessage(0, {
        expectedMessageText: messageText,
        expectedContentTopic: TestContentTopic
      });

      // Modify subscription to include a new content topic and send a message.
      const newMessageText = "Filtering still works!";
      const newMessagePayload = { payload: utf8ToBytes(newMessageText) };
      const newContentTopic = "/test/2/waku-filter";
      const newEncoder = createEncoder({ contentTopic: newContentTopic });
      const newDecoder = createDecoder(newContentTopic);
      await subscription.subscribe(
        [newDecoder],
        serviceNodes.messageCollector.callback
      );
      await waku.lightPush.send(newEncoder, {
        payload: utf8ToBytes(newMessageText)
      });
      expect(await serviceNodes.messageCollector.waitForMessages(2)).to.eq(
        true
      );
      serviceNodes.messageCollector.verifyReceivedMessage(1, {
        expectedContentTopic: newContentTopic,
        expectedMessageText: newMessageText
      });

      // Send another message on the initial content topic to verify it still works.
      await waku.lightPush.send(TestEncoder, newMessagePayload);
      expect(await serviceNodes.messageCollector.waitForMessages(3)).to.eq(
        true
      );
      serviceNodes.messageCollector.verifyReceivedMessage(2, {
        expectedMessageText: newMessageText,
        expectedContentTopic: TestContentTopic
      });

      await serviceNodes.confirmMessageLength(3);
    });

    it("Subscribe and receives messages on 20 topics", async function () {
      const topicCount = 20;
      const td = generateTestData(topicCount);

      // Subscribe to all 20 topics.
      for (let i = 0; i < topicCount; i++) {
        await subscription.subscribe(
          [td.decoders[i]],
          serviceNodes.messageCollector.callback
        );
      }

      // Send a unique message on each topic.
      for (let i = 0; i < topicCount; i++) {
        await waku.lightPush.send(td.encoders[i], {
          payload: utf8ToBytes(`Message for Topic ${i + 1}`)
        });
      }

      // Verify that each message was received on the corresponding topic.
      expect(await serviceNodes.messageCollector.waitForMessages(20)).to.eq(
        true
      );
      td.contentTopics.forEach((topic, index) => {
        serviceNodes.messageCollector.verifyReceivedMessage(index, {
          expectedContentTopic: topic,
          expectedMessageText: `Message for Topic ${index + 1}`
        });
      });
    });

    it("Subscribe to 30 topics at once and receives messages", async function () {
      const topicCount = 30;
      const td = generateTestData(topicCount);

      // Subscribe to all 30 topics.
      await subscription.subscribe(
        td.decoders,
        serviceNodes.messageCollector.callback
      );

      // Send a unique message on each topic.
      for (let i = 0; i < topicCount; i++) {
        await waku.lightPush.send(td.encoders[i], {
          payload: utf8ToBytes(`Message for Topic ${i + 1}`)
        });
      }

      // Verify that each message was received on the corresponding topic.
      expect(await serviceNodes.messageCollector.waitForMessages(30)).to.eq(
        true
      );
      td.contentTopics.forEach((topic, index) => {
        serviceNodes.messageCollector.verifyReceivedMessage(index, {
          expectedContentTopic: topic,
          expectedMessageText: `Message for Topic ${index + 1}`
        });
      });
    });

    it("Error when try to subscribe to more than 30 topics", async function () {
      const topicCount = 31;
      const td = generateTestData(topicCount);

      // Attempt to subscribe to 31 topics
      try {
        await subscription.subscribe(
          td.decoders,
          serviceNodes.messageCollector.callback
        );
        throw new Error(
          "Subscribe to 31 topics was successful but was expected to fail with a specific error."
        );
      } catch (err) {
        if (
          err instanceof Error &&
          err.message.includes("exceeds maximum content topics: 30")
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
      const td1 = generateTestData(topicCount1);
      const topicCount2 = 4;
      const td2 = generateTestData(topicCount2);

      // Subscribe to the first set of topics.
      await subscription.subscribe(
        td1.decoders,
        serviceNodes.messageCollector.callback
      );

      // Subscribe to the second set of topics which has overlapping topics with the first set.
      await subscription.subscribe(
        td2.decoders,
        serviceNodes.messageCollector.callback
      );

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
      expect(
        await serviceNodes.messageCollector.waitForMessages(6, { exact: true })
      ).to.eq(true);
    });

    it("Refresh subscription", async function () {
      await subscription.subscribe(
        [TestDecoder],
        serviceNodes.messageCollector.callback
      );
      await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M1") });

      // Resubscribe (refresh) to the same topic and send another message.
      await subscription.subscribe(
        [TestDecoder],
        serviceNodes.messageCollector.callback
      );
      await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M2") });

      // Confirm both messages were received.
      expect(
        await serviceNodes.messageCollector.waitForMessages(2, { exact: true })
      ).to.eq(true);
      serviceNodes.messageCollector.verifyReceivedMessage(0, {
        expectedMessageText: "M1",
        expectedContentTopic: TestContentTopic
      });
      serviceNodes.messageCollector.verifyReceivedMessage(1, {
        expectedMessageText: "M2",
        expectedContentTopic: TestContentTopic
      });
    });

    TEST_STRING.forEach((testItem) => {
      it(`Subscribe to topic containing ${testItem.description} and receive message`, async function () {
        const newContentTopic = testItem.value;
        const newEncoder = createEncoder({ contentTopic: newContentTopic });
        const newDecoder = createDecoder(newContentTopic);

        await subscription.subscribe(
          [newDecoder],
          serviceNodes.messageCollector.callback
        );
        await waku.lightPush.send(newEncoder, messagePayload);

        expect(await serviceNodes.messageCollector.waitForMessages(1)).to.eq(
          true
        );
        serviceNodes.messageCollector.verifyReceivedMessage(0, {
          expectedMessageText: messageText,
          expectedContentTopic: newContentTopic
        });
      });
    });

    it("Add multiple subscription objects on single nwaku node", async function () {
      await subscription.subscribe(
        [TestDecoder],
        serviceNodes.messageCollector.callback
      );
      await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M1") });

      // Create a second subscription on a different topic
      const subscription2 = await waku.filter.createSubscription();
      const newContentTopic = "/test/2/waku-filter";
      const newEncoder = createEncoder({ contentTopic: newContentTopic });
      const newDecoder = createDecoder(newContentTopic);
      await subscription2.subscribe(
        [newDecoder],
        serviceNodes.messageCollector.callback
      );

      await waku.lightPush.send(newEncoder, { payload: utf8ToBytes("M2") });

      // Check if both messages were received
      expect(await serviceNodes.messageCollector.waitForMessages(2)).to.eq(
        true
      );
      serviceNodes.messageCollector.verifyReceivedMessage(0, {
        expectedMessageText: "M1",
        expectedContentTopic: TestContentTopic
      });
      serviceNodes.messageCollector.verifyReceivedMessage(1, {
        expectedContentTopic: newContentTopic,
        expectedMessageText: "M2"
      });
    });
  });
};

[true, false].map((strictCheckNodes) => runTests(strictCheckNodes));

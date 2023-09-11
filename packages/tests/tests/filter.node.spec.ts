import {
  createDecoder,
  createEncoder,
  DecodedMessage,
  Decoder,
  DefaultPubSubTopic,
  Encoder,
  waitForRemotePeer
} from "@waku/core";
import type { IFilterSubscription, LightNode } from "@waku/interfaces";
import { Protocols } from "@waku/interfaces";
import { createLightNode } from "@waku/sdk";
import { bytesToUtf8, utf8ToBytes } from "@waku/utils/bytes";
import { expect } from "chai";
import debug from "debug";
import pRetry from "p-retry";

import {
  delay,
  makeLogFileName,
  NimGoNode,
  NOISE_KEY_1,
  TEST_STRING,
  TEST_TIMESTAMPS
} from "../src/index.js";

// Constants for test configuration.
const log = debug("waku:test:filter");
const TestContentTopic = "/test/1/waku-filter";
const TestEncoder = createEncoder({ contentTopic: TestContentTopic });
const TestDecoder = createDecoder(TestContentTopic);
const messageText = "Filtering works!";
const messagePayload = { payload: utf8ToBytes(messageText) };

/**
 * Class responsible for collecting messages.
 * It provides utility methods to interact with the collected messages,
 * and offers a way to wait for incoming messages.
 */
class MessageCollector {
  list: Array<DecodedMessage> = [];

  // Callback to handle incoming messages.
  callback = (msg: DecodedMessage): void => {
    log("Got a message");
    this.list.push(msg);
  };

  get count(): number {
    return this.list.length;
  }

  getMessage(index: number): DecodedMessage {
    return this.list[index];
  }

  async waitForMessages(
    numMessages: number,
    timeoutDuration: number = 400
  ): Promise<boolean> {
    const startTime = Date.now();

    while (this.count < numMessages) {
      if (Date.now() - startTime > timeoutDuration * numMessages) {
        return false;
      }
      await delay(10);
    }

    return true;
  }

  // Verifies a received message against expected values.
  verifyReceivedMessage(options: {
    index: number;
    expectedContentTopic?: string;
    expectedPubSubTopic?: string;
    expectedMessageText?: string | Uint8Array;
    expectedVersion?: number;
    expectedMeta?: Uint8Array;
    expectedEphemeral?: boolean;
    checkTimestamp?: boolean; // Used to determine if we need to check the timestamp
  }): void {
    expect(this.list.length).to.be.greaterThan(
      options.index,
      `The message list does not have a message at index ${options.index}`
    );

    const message = this.getMessage(options.index);
    expect(message.contentTopic).to.eq(
      options.expectedContentTopic || TestContentTopic,
      `Message content topic mismatch. Expected: ${
        options.expectedContentTopic || TestContentTopic
      }. Got: ${message.contentTopic}`
    );

    expect(message.pubSubTopic).to.eq(
      options.expectedPubSubTopic || DefaultPubSubTopic,
      `Message pub/sub topic mismatch. Expected: ${
        options.expectedPubSubTopic || DefaultPubSubTopic
      }. Got: ${message.pubSubTopic}`
    );

    expect(bytesToUtf8(message.payload)).to.eq(
      options.expectedMessageText || messageText,
      `Message text mismatch. Expected: ${
        options.expectedMessageText || messageText
      }. Got: ${bytesToUtf8(message.payload)}`
    );

    expect(message.version).to.eq(
      options.expectedVersion || 0,
      `Message version mismatch. Expected: ${
        options.expectedVersion || 0
      }. Got: ${message.version}`
    );

    const shouldCheckTimestamp =
      options.checkTimestamp !== undefined ? options.checkTimestamp : true;
    if (shouldCheckTimestamp && message.timestamp) {
      const now = Date.now();
      const tenSecondsAgo = now - 10000;
      expect(message.timestamp.getTime()).to.be.within(
        tenSecondsAgo,
        now,
        `Message timestamp not within the expected range. Expected between: ${tenSecondsAgo} and ${now}. Got: ${message.timestamp.getTime()}`
      );
    }

    expect([
      options.expectedMeta,
      undefined,
      new Uint8Array(0)
    ]).to.deep.include(
      message.meta,
      `Message meta mismatch. Expected: ${
        options.expectedMeta
          ? JSON.stringify(options.expectedMeta)
          : "undefined or " + JSON.stringify(new Uint8Array(0))
      }. Got: ${JSON.stringify(message.meta)}`
    );

    expect(message.ephemeral).to.eq(
      options.expectedEphemeral !== undefined
        ? options.expectedEphemeral
        : false,
      `Message ephemeral value mismatch. Expected: ${
        options.expectedEphemeral !== undefined
          ? options.expectedEphemeral
          : false
      }. Got: ${message.ephemeral}`
    );
  }
}

// Utility to generate test data for multiple topics tests.
function generateTestData(topicCount: number): {
  contentTopics: string[];
  encoders: Encoder[];
  decoders: Decoder[];
} {
  const contentTopics = Array.from(
    { length: topicCount },
    (_, i) => `/test/${i + 1}/waku-multi`
  );
  const encoders = contentTopics.map((topic) =>
    createEncoder({ contentTopic: topic })
  );
  const decoders = contentTopics.map((topic) => createDecoder(topic));
  return {
    contentTopics,
    encoders,
    decoders
  };
}

// Utility to validate errors related to pings in the subscription.
async function validatePingError(
  subscription: IFilterSubscription
): Promise<void> {
  try {
    await subscription.ping();
    throw new Error(
      "Ping was successful but was expected to fail with a specific error."
    );
  } catch (err) {
    if (
      err instanceof Error &&
      err.message.includes("peer has no subscriptions")
    ) {
      return;
    } else {
      throw err;
    }
  }
}

describe("Waku Filter: V2", function () {
  // Set the timeout for all tests in this suite. Can be overwritten at test level
  this.timeout(10000);
  let waku: LightNode;
  let nwaku: NimGoNode;
  let nwaku2: NimGoNode;
  let subscription: IFilterSubscription;
  let messageCollector: MessageCollector;

  this.afterEach(async function () {
    !!nwaku &&
      nwaku.stop().catch((e) => console.log("Nwaku failed to stop", e));
    !!nwaku2 &&
      nwaku2.stop().catch((e) => console.log("Nwaku2 failed to stop", e));
    !!waku && waku.stop().catch((e) => console.log("Waku failed to stop", e));
  });

  this.beforeEach(async function () {
    this.timeout(15000);

    // Setup before each test to initialize nodes and message collector.
    // Sometimes the node setup fails, when that happens we retry it max 3 times.
    await pRetry(
      async () => {
        try {
          nwaku = new NimGoNode(makeLogFileName(this));
          await nwaku.start({
            filter: true,
            lightpush: true,
            relay: true
          });
        } catch (error) {
          console.log("nwaku node failed to start:", error);
          throw error;
        }
      },
      { retries: 3 }
    );

    try {
      waku = await createLightNode({
        staticNoiseKey: NOISE_KEY_1,
        libp2p: { addresses: { listen: ["/ip4/0.0.0.0/tcp/0/ws"] } }
      });
      await waku.start();
    } catch (error) {
      console.log("jswaku node failed to start:", error);
    }
    await waku.dial(await nwaku.getMultiaddrWithId());
    await waitForRemotePeer(waku, [Protocols.Filter, Protocols.LightPush]);
    subscription = await waku.filter.createSubscription();
    messageCollector = new MessageCollector();
  });

  it("Subscribe and receive messages via lightPush", async function () {
    // Subscribe to the content topic and set callback for received messages.
    await subscription.subscribe([TestDecoder], messageCollector.callback);

    // Send a test message using the lightPush method.
    await waku.lightPush.send(TestEncoder, messagePayload);

    // Verify that the message was successfully received.
    expect(await messageCollector.waitForMessages(1)).to.eq(true);
    messageCollector.verifyReceivedMessage({ index: 0 });
    expect((await nwaku.messages()).length).to.eq(1);
  });

  it("Subscribe and receive messages via waku relay post", async function () {
    // Subscribe to the content topic and set callback for received messages.
    await subscription.subscribe([TestDecoder], messageCollector.callback);

    // Introduce a brief delay before sending the message.
    await delay(400);

    // Send a test message using the relay post method.
    await nwaku.sendMessage(
      NimGoNode.toMessageRpcQuery({
        contentTopic: TestContentTopic,
        payload: utf8ToBytes(messageText)
      })
    );

    // Verify that the message was successfully received.
    expect(await messageCollector.waitForMessages(1)).to.eq(true);
    messageCollector.verifyReceivedMessage({ index: 0 });
    expect((await nwaku.messages()).length).to.eq(1);
  });

  it("Subscribe and receive 2 messages on the same topic", async function () {
    // Subscribe to the content topic and set callback for received messages.
    await subscription.subscribe([TestDecoder], messageCollector.callback);

    // Send the initial test message using the lightPush method.
    await waku.lightPush.send(TestEncoder, messagePayload);

    // Verify that the first message was successfully received.
    expect(await messageCollector.waitForMessages(1)).to.eq(true);
    //
    messageCollector.verifyReceivedMessage({ index: 0 });

    // Send another message on the same topic.
    const newMessageText = "Filtering still works!";
    await waku.lightPush.send(TestEncoder, {
      payload: utf8ToBytes(newMessageText)
    });

    // Verify that the second message was successfully received.
    expect(await messageCollector.waitForMessages(2)).to.eq(true);
    messageCollector.verifyReceivedMessage({
      expectedMessageText: newMessageText,
      index: 1
    });
    expect((await nwaku.messages()).length).to.eq(2);
  });

  it("Subscribe and receive messages on 2 different content topics", async function () {
    // Subscribe to the first content topic and send a message.
    await subscription.subscribe([TestDecoder], messageCollector.callback);
    await waku.lightPush.send(TestEncoder, messagePayload);
    expect(await messageCollector.waitForMessages(1)).to.eq(true);
    messageCollector.verifyReceivedMessage({ index: 0 });

    // Modify subscription to include a new content topic and send a message.
    const newMessageText = "Filtering still works!";
    const newMessagePayload = { payload: utf8ToBytes(newMessageText) };
    const newContentTopic = "/test/2/waku-filter";
    const newEncoder = createEncoder({ contentTopic: newContentTopic });
    const newDecoder = createDecoder(newContentTopic);
    await subscription.subscribe([newDecoder], messageCollector.callback);
    await waku.lightPush.send(newEncoder, {
      payload: utf8ToBytes(newMessageText)
    });
    expect(await messageCollector.waitForMessages(2)).to.eq(true);
    messageCollector.verifyReceivedMessage({
      expectedContentTopic: newContentTopic,
      expectedMessageText: newMessageText,
      index: 1
    });

    // Send another message on the initial content topic to verify it still works.
    await waku.lightPush.send(TestEncoder, newMessagePayload);
    expect(await messageCollector.waitForMessages(3)).to.eq(true);
    messageCollector.verifyReceivedMessage({
      expectedMessageText: newMessageText,
      index: 2
    });
    expect((await nwaku.messages()).length).to.eq(3);
  });

  it("Subscribe and receives messages on 20 topics", async function () {
    const topicCount = 20;
    const td = generateTestData(topicCount);

    // Subscribe to all 20 topics.
    for (let i = 0; i < topicCount; i++) {
      await subscription.subscribe([td.decoders[i]], messageCollector.callback);
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
      messageCollector.verifyReceivedMessage({
        expectedContentTopic: topic,
        expectedMessageText: `Message for Topic ${index + 1}`,
        index: index
      });
    });
  });

  it("Subscribe to 30 topics at once and receives messages", async function () {
    const topicCount = 30;
    const td = generateTestData(topicCount);

    // Subscribe to all 30 topics.
    await subscription.subscribe(td.decoders, messageCollector.callback);

    // Send a unique message on each topic.
    for (let i = 0; i < topicCount; i++) {
      await waku.lightPush.send(td.encoders[i], {
        payload: utf8ToBytes(`Message for Topic ${i + 1}`)
      });
    }

    // Verify that each message was received on the corresponding topic.
    expect(await messageCollector.waitForMessages(30)).to.eq(true);
    td.contentTopics.forEach((topic, index) => {
      messageCollector.verifyReceivedMessage({
        expectedContentTopic: topic,
        expectedMessageText: `Message for Topic ${index + 1}`,
        index: index
      });
    });
  });

  it("Error when try to subscribe to more than 30 topics", async function () {
    const topicCount = 31;
    const td = generateTestData(topicCount);

    // Attempt to subscribe to 31 topics (expecting an error since the maximum is 30).
    try {
      await subscription.subscribe(td.decoders, messageCollector.callback);
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
    await subscription.subscribe(td1.decoders, messageCollector.callback);

    // Subscribe to the second set of topics which has overlapping topics with the first set.
    await subscription.subscribe(td2.decoders, messageCollector.callback);

    // Send messages to the first set of topics.
    for (let i = 0; i < topicCount1; i++) {
      const messageText = `Message for Topic ${i + 1}`;
      await waku.lightPush.send(td1.encoders[i], {
        payload: utf8ToBytes(messageText)
      });
    }

    // Send messages to the second set of topics.
    for (let i = 0; i < topicCount2; i++) {
      const messageText = `Message for Topic ${i + 1}`;
      await waku.lightPush.send(td2.encoders[i], {
        payload: utf8ToBytes(messageText)
      });
    }

    // Check if all messages were received.
    // Since there are overlapping topics, there should be 6 messages in total (2 from the first set + 4 from the second set).
    expect(await messageCollector.waitForMessages(6)).to.eq(true);
  });

  it("Refresh subscription", async function () {
    // Subscribe to a topic and send a message.
    await subscription.subscribe([TestDecoder], messageCollector.callback);
    await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M1") });

    // Resubscribe (refresh) to the same topic and send another message.
    await subscription.subscribe([TestDecoder], messageCollector.callback);
    await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M2") });

    // Confirm both messages were received.
    expect(await messageCollector.waitForMessages(2)).to.eq(true);
    messageCollector.verifyReceivedMessage({
      index: 0,
      expectedMessageText: "M1"
    });
    messageCollector.verifyReceivedMessage({
      index: 1,
      expectedMessageText: "M2"
    });
  });

  TEST_STRING.forEach((testItem) => {
    it(`Subscribe to topic containing ${testItem.description} and receive message`, async function () {
      // Set the new content topic based on the current test item.
      const newContentTopic = testItem.value;

      // Create a new encoder and decoder for the specified content topic.
      const newEncoder = createEncoder({ contentTopic: newContentTopic });
      const newDecoder = createDecoder(newContentTopic);

      // Subscribe to the new content topic and send a message
      await subscription.subscribe([newDecoder], messageCollector.callback);
      await waku.lightPush.send(newEncoder, messagePayload);

      // Expect that a message was received.
      expect(await messageCollector.waitForMessages(1)).to.eq(true);
      messageCollector.verifyReceivedMessage({
        index: 0,
        expectedContentTopic: newContentTopic
      });
    });
  });

  it("Add multiple subscribtions object on single nwaku node", async function () {
    // Initial subscription and message send
    await subscription.subscribe([TestDecoder], messageCollector.callback);
    await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M1") });

    // Create a second subscription on a different topic
    const subscription2 = await waku.filter.createSubscription();
    const newContentTopic = "/test/2/waku-filter";
    const newEncoder = createEncoder({ contentTopic: newContentTopic });
    const newDecoder = createDecoder(newContentTopic);
    await subscription2.subscribe([newDecoder], messageCollector.callback);

    // Send a message using the second subscription
    await waku.lightPush.send(newEncoder, { payload: utf8ToBytes("M2") });

    // Check if both messages were received
    expect(await messageCollector.waitForMessages(2)).to.eq(true);
    messageCollector.verifyReceivedMessage({
      index: 0,
      expectedMessageText: "M1"
    });
    messageCollector.verifyReceivedMessage({
      index: 1,
      expectedContentTopic: newContentTopic,
      expectedMessageText: "M2"
    });
  });

  // this test fail 50% of times with messageCount being 1. Seems like a message is lost somehow
  it.skip("Subscribe and receive messages from multiple nwaku nodes", async function () {
    // Initial subscription and message send
    await subscription.subscribe([TestDecoder], messageCollector.callback);
    await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M1") });
    expect(await messageCollector.waitForMessages(1)).to.eq(true);

    // Set up and start a new nwaku node
    nwaku2 = new NimGoNode(makeLogFileName(this) + "2");
    await nwaku2.start({ filter: true, lightpush: true, relay: true });

    // Connect to the new nwaku node and set up a new subscription
    await waku.dial(await nwaku2.getMultiaddrWithId());
    await waitForRemotePeer(waku, [Protocols.Filter, Protocols.LightPush]);
    const subscription2 = await waku.filter.createSubscription(
      DefaultPubSubTopic,
      await nwaku2.getPeerId()
    );

    // Send a message using the new subscription
    const newContentTopic = "/test/2/waku-filter";
    const newEncoder = createEncoder({ contentTopic: newContentTopic });
    const newDecoder = createDecoder(newContentTopic);
    await subscription2.subscribe([newDecoder], messageCollector.callback);
    await waku.lightPush.send(newEncoder, { payload: utf8ToBytes("M2") });

    // Check if both messages were received
    expect(await messageCollector.waitForMessages(2)).to.eq(true);
    messageCollector.verifyReceivedMessage({
      index: 0,
      expectedMessageText: "M1"
    });
    messageCollector.verifyReceivedMessage({
      index: 1,
      expectedContentTopic: newContentTopic,
      expectedMessageText: "M2"
    });
  });

  TEST_STRING.forEach((testItem) => {
    it(`Check receive message containing ${testItem.description}`, async function () {
      // Setup subscription and send message
      await subscription.subscribe([TestDecoder], messageCollector.callback);
      await waku.lightPush.send(TestEncoder, {
        payload: utf8ToBytes(testItem.value)
      });

      // Verify message reception
      expect(await messageCollector.waitForMessages(1)).to.eq(true);
      messageCollector.verifyReceivedMessage({
        index: 0,
        expectedMessageText: testItem.value
      });
    });
  });

  TEST_TIMESTAMPS.forEach((testItem) => {
    it(`Check received message with timestamp: ${testItem} `, async function () {
      await subscription.subscribe([TestDecoder], messageCollector.callback);
      await delay(400);

      // Send message with a timestamp via RPC call
      await nwaku.rpcCall("post_waku_v2_relay_v1_message", [
        DefaultPubSubTopic,
        {
          contentTopic: TestContentTopic,
          payload: Buffer.from(utf8ToBytes(messageText)).toString("base64"),
          timestamp: testItem
        }
      ]);

      // Verify message reception
      expect(await messageCollector.waitForMessages(1)).to.eq(true);
      messageCollector.verifyReceivedMessage({
        index: 0,
        checkTimestamp: false
      });

      // Check if the timestamp matches
      const timestamp = messageCollector.getMessage(0).timestamp;
      if (testItem == undefined) {
        expect(timestamp).to.eq(undefined);
      }
      if (timestamp !== undefined) {
        expect(testItem?.toString()).to.contain(timestamp.getTime().toString());
      }
    });
  });

  it("Check message with invalid timestamp is not received", async function () {
    await subscription.subscribe([TestDecoder], messageCollector.callback);
    await delay(400);

    // Send message via RPC call
    await nwaku.rpcCall("post_waku_v2_relay_v1_message", [
      DefaultPubSubTopic,
      {
        contentTopic: TestContentTopic,
        payload: Buffer.from(utf8ToBytes(messageText)).toString("base64"),
        timestamp: "2023-09-06T12:05:38.609Z"
      }
    ]);

    // Verify that no message was received
    expect(await messageCollector.waitForMessages(1)).to.eq(false);
  });

  it("Check message on other pubsub topic is not received", async function () {
    await subscription.subscribe([TestDecoder], messageCollector.callback);
    await delay(400);

    // Send message via RPC call
    await nwaku.rpcCall("post_waku_v2_relay_v1_message", [
      "DefaultPubSubTopic",
      {
        contentTopic: TestContentTopic,
        payload: Buffer.from(utf8ToBytes(messageText)).toString("base64"),
        timestamp: BigInt(Date.now()) * BigInt(1000000)
      }
    ]);

    // Verify that no message was received
    expect(await messageCollector.waitForMessages(1)).to.eq(false);
  });

  it("Check message with no pubsub topic is not received", async function () {
    await subscription.subscribe([TestDecoder], messageCollector.callback);
    await delay(400);

    // Send message via RPC call
    await nwaku.rpcCall("post_waku_v2_relay_v1_message", [
      {
        contentTopic: TestContentTopic,
        payload: Buffer.from(utf8ToBytes(messageText)).toString("base64"),
        timestamp: BigInt(Date.now()) * BigInt(1000000)
      }
    ]);

    // Verify that no message was received
    expect(await messageCollector.waitForMessages(1)).to.eq(false);
  });

  it("Check message with no content topic is not received", async function () {
    await subscription.subscribe([TestDecoder], messageCollector.callback);
    await delay(400);

    // Send message via RPC call
    await nwaku.rpcCall("post_waku_v2_relay_v1_message", [
      DefaultPubSubTopic,
      {
        payload: Buffer.from(utf8ToBytes(messageText)).toString("base64"),
        timestamp: BigInt(Date.now()) * BigInt(1000000)
      }
    ]);

    // Verify that no message was received
    expect(await messageCollector.waitForMessages(1)).to.eq(false);
  });

  it("Check message with no payload is not received", async function () {
    await subscription.subscribe([TestDecoder], messageCollector.callback);
    await delay(400);

    // Send message via RPC call
    await nwaku.rpcCall("post_waku_v2_relay_v1_message", [
      DefaultPubSubTopic,
      {
        contentTopic: TestContentTopic,
        timestamp: BigInt(Date.now()) * BigInt(1000000)
      }
    ]);

    // For go-waku the message is received (it is possible to send a message with no payload)
    if (nwaku.type() == "go-waku") {
      expect(await messageCollector.waitForMessages(1)).to.eq(true);
    } else {
      expect(await messageCollector.waitForMessages(1)).to.eq(false);
    }
  });

  it("Check message with non string payload is not received", async function () {
    await subscription.subscribe([TestDecoder], messageCollector.callback);
    await delay(400);

    // Send message via RPC call
    await nwaku.rpcCall("post_waku_v2_relay_v1_message", [
      DefaultPubSubTopic,
      {
        contentTopic: TestContentTopic,
        payload: 12345,
        timestamp: BigInt(Date.now()) * BigInt(1000000)
      }
    ]);

    // Verify that no message was received
    expect(await messageCollector.waitForMessages(1)).to.eq(false);
  });

  it("Check message with extra parameter is not received", async function () {
    await subscription.subscribe([TestDecoder], messageCollector.callback);
    await delay(400);

    // Send message via RPC call
    await nwaku.rpcCall("post_waku_v2_relay_v1_message", [
      DefaultPubSubTopic,
      "extraField",
      {
        contentTopic: TestContentTopic,
        payload: Buffer.from(utf8ToBytes(messageText)).toString("base64"),
        timestamp: BigInt(Date.now()) * BigInt(1000000)
      }
    ]);

    // Verify that no message was received
    expect(await messageCollector.waitForMessages(1)).to.eq(false);
  });

  it("Check message with extra option is received", async function () {
    await subscription.subscribe([TestDecoder], messageCollector.callback);
    await delay(400);

    // Send message via RPC call
    await nwaku.rpcCall("post_waku_v2_relay_v1_message", [
      DefaultPubSubTopic,
      {
        contentTopic: TestContentTopic,
        payload: Buffer.from(utf8ToBytes(messageText)).toString("base64"),
        timestamp: BigInt(Date.now()) * BigInt(1000000),
        extraOption: "extraOption"
      }
    ]);

    // Verify that message was received
    expect(await messageCollector.waitForMessages(1)).to.eq(true);
    messageCollector.verifyReceivedMessage({ index: 0 });
  });

  // Will be skipped until https://github.com/waku-org/js-waku/issues/1464 si done
  it.skip("Check message received after jswaku node is restarted", async function () {
    // Subscribe and send message
    await subscription.subscribe([TestDecoder], messageCollector.callback);
    await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M1") });
    expect(await messageCollector.waitForMessages(1)).to.eq(true);

    // Restart js-waku node
    await waku.stop();
    expect(waku.isStarted()).to.eq(false);
    await waku.start();
    expect(waku.isStarted()).to.eq(true);

    // Redo the connection and create a new subscription
    await waku.dial(await nwaku.getMultiaddrWithId());
    await waitForRemotePeer(waku, [Protocols.Filter, Protocols.LightPush]);
    subscription = await waku.filter.createSubscription();
    await subscription.subscribe([TestDecoder], messageCollector.callback);

    // Resend message
    await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M2") });

    // Confirm both messages were received.
    expect(await messageCollector.waitForMessages(2)).to.eq(true);
    messageCollector.verifyReceivedMessage({
      index: 0,
      expectedMessageText: "M1"
    });
    messageCollector.verifyReceivedMessage({
      index: 1,
      expectedMessageText: "M2"
    });
  });

  // Will be skipped until https://github.com/waku-org/js-waku/issues/1464 si done
  it.skip("Check message received after nwaku node is restarted", async function () {
    await subscription.subscribe([TestDecoder], messageCollector.callback);
    await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M1") });
    expect(await messageCollector.waitForMessages(1)).to.eq(true);

    // Restart nwaku node
    await nwaku.stop();
    await nwaku.start();
    await waitForRemotePeer(waku, [Protocols.Filter, Protocols.LightPush]);

    // Resend message
    await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M2") });

    // Confirm both messages were received.
    expect(await messageCollector.waitForMessages(2)).to.eq(true);
    messageCollector.verifyReceivedMessage({
      index: 0,
      expectedMessageText: "M1"
    });
    messageCollector.verifyReceivedMessage({
      index: 1,
      expectedMessageText: "M2"
    });
  });

  it("Ping on subscribed peer", async function () {
    await subscription.subscribe([TestDecoder], messageCollector.callback);
    await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M1") });
    expect(await messageCollector.waitForMessages(1)).to.eq(true);

    // If ping is successfull(node has active subscription) we receive a success status code.
    await subscription.ping();

    await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M2") });

    // Confirm new messages are received after a ping.
    expect(await messageCollector.waitForMessages(2)).to.eq(true);
  });

  it("Ping on peer without subscriptions", async function () {
    await validatePingError(subscription);
  });

  it("ping on unsubscribed peer", async function () {
    await subscription.subscribe([TestDecoder], messageCollector.callback);
    await subscription.ping();
    await subscription.unsubscribe([TestContentTopic]);

    // Ping imediately after unsubscribe
    await validatePingError(subscription);
  });

  it("Unsubscribe 1 topic - node subscribed to 1 topic", async function () {
    // Subscribe to 1 topic and send message
    await subscription.subscribe([TestDecoder], messageCollector.callback);
    await waku.lightPush.send(TestEncoder, messagePayload);
    expect(await messageCollector.waitForMessages(1)).to.eq(true);

    // Unsubscribe from the topic and send again
    await subscription.unsubscribe([TestContentTopic]);
    await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M1") });
    expect(await messageCollector.waitForMessages(2)).to.eq(false);

    // Check that from 2 messages send only the 1st was received
    messageCollector.verifyReceivedMessage({ index: 0 });
    expect(messageCollector.count).to.eq(1);
    expect((await nwaku.messages()).length).to.eq(2);
  });

  it("Unsubscribe 1 topic - node subscribed to 2 topics", async function () {
    // Subscribe to 2 topics and send messages
    await subscription.subscribe([TestDecoder], messageCollector.callback);
    const newContentTopic = "/test/2/waku-filter";
    const newEncoder = createEncoder({ contentTopic: newContentTopic });
    const newDecoder = createDecoder(newContentTopic);
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
    await subscription.subscribe([TestDecoder], messageCollector.callback);
    const newContentTopic = "/test/2/waku-filter";
    const newEncoder = createEncoder({ contentTopic: newContentTopic });
    const newDecoder = createDecoder(newContentTopic);
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
    await subscription.subscribe([TestDecoder], messageCollector.callback);
    await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M1") });
    expect(await messageCollector.waitForMessages(1)).to.eq(true);

    expect(messageCollector.count).to.eq(1);

    // Unsubscribe from topics that the node is not not subscribed to and send again
    await subscription.unsubscribe([]);
    await subscription.unsubscribe(["/test/2/waku-filter"]);
    await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M2") });
    expect(await messageCollector.waitForMessages(2)).to.eq(true);

    // Check that both messages were received
    expect(messageCollector.count).to.eq(2);
    expect((await nwaku.messages()).length).to.eq(2);
  });

  it("Unsubscribes all - node subscribed to 1 topic", async function () {
    // Subscribe to 1 topic and send message
    await subscription.subscribe([TestDecoder], messageCollector.callback);
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
    const td = generateTestData(topicCount);
    await subscription.subscribe(td.decoders, messageCollector.callback);
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

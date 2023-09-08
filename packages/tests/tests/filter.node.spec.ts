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
  testStrings,
  testTimestamps
} from "../src/index.js";

const log = debug("waku:test:filter");
const TestContentTopic = "/test/1/waku-filter";
const TestEncoder = createEncoder({ contentTopic: TestContentTopic });
const TestDecoder = createDecoder(TestContentTopic);
const messageText = "Filtering works!";
const messagePayload = { payload: utf8ToBytes(messageText) };

class MessageCollector {
  list: Array<DecodedMessage> = [];
  private resolveFn?: (msg: DecodedMessage) => void;
  private messageReceived!: Promise<DecodedMessage>;

  constructor() {
    this.reset_message_received_flag();
  }

  // needs to be explicitly called to reset the message received flag
  reset_message_received_flag(): void {
    this.messageReceived = new Promise<DecodedMessage>((resolve) => {
      this.resolveFn = resolve;
    });
  }

  callback = (msg: DecodedMessage): void => {
    log("Got a message");
    this.list.push(msg);
    if (this.resolveFn) {
      this.resolveFn(msg);
      this.resolveFn = undefined;
    }
  };

  get count(): number {
    return this.list.length;
  }

  getMessage(index: number): DecodedMessage {
    return this.list[index];
  }

  async waitForMessage(timeoutDuration: number = 400): Promise<boolean> {
    const timeout = new Promise<boolean>((resolve) =>
      setTimeout(() => resolve(false), timeoutDuration)
    );
    const received = this.messageReceived.then(() => true);
    return await Promise.race([received, timeout]);
  }

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

    expect(message.meta).to.eql(
      options.expectedMeta || new Uint8Array(0),
      `Message meta mismatch. Expected: ${JSON.stringify(
        options.expectedMeta || new Uint8Array(0)
      )}. Got: ${JSON.stringify(message.meta)}`
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

// function used to generate multiple topics
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
      err.message.includes("404: NOT_FOUND: peer has no subscriptions")
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

    // sometimes the node setup fails, when that happens we retry it max 3 times
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
    await subscription.subscribe([TestDecoder], messageCollector.callback);
    await waku.lightPush.send(TestEncoder, messagePayload);
    expect(await messageCollector.waitForMessage()).to.eq(true);
    messageCollector.verifyReceivedMessage({ index: 0 });
    expect(messageCollector.count).to.eq(1);
    expect((await nwaku.messages()).length).to.eq(1);
  });

  it("Subscribe and receive messages via waku relay post", async function () {
    await subscription.subscribe([TestDecoder], messageCollector.callback);
    await delay(400);
    await nwaku.sendMessage(
      NimGoNode.toMessageRpcQuery({
        contentTopic: TestContentTopic,
        payload: utf8ToBytes(messageText)
      })
    );
    expect(await messageCollector.waitForMessage()).to.eq(true);
    messageCollector.verifyReceivedMessage({ index: 0 });
    expect(messageCollector.count).to.eq(1);
    expect((await nwaku.messages()).length).to.eq(1);
  });

  it("Subscribe and receive 2 messages on the same topic", async function () {
    await subscription.subscribe([TestDecoder], messageCollector.callback);
    await waku.lightPush.send(TestEncoder, messagePayload);
    expect(await messageCollector.waitForMessage()).to.eq(true);
    messageCollector.verifyReceivedMessage({ index: 0 });
    const newMessageText = "Filtering still works!";
    await waku.lightPush.send(TestEncoder, {
      payload: utf8ToBytes(newMessageText)
    });
    expect(await messageCollector.waitForMessage()).to.eq(true);
    messageCollector.verifyReceivedMessage({
      expectedMessageText: newMessageText,
      index: 1
    });
    expect(messageCollector.count).to.eq(2);
    expect((await nwaku.messages()).length).to.eq(2);
  });

  it("Subscribe and receive messages on 2 different content topics", async function () {
    await subscription.subscribe([TestDecoder], messageCollector.callback);
    await waku.lightPush.send(TestEncoder, messagePayload);
    expect(await messageCollector.waitForMessage()).to.eq(true);
    messageCollector.verifyReceivedMessage({ index: 0 });
    // Modify subscription
    const newMessageText = "Filtering still works!";
    const newMessagePayload = { payload: utf8ToBytes(newMessageText) };
    const newContentTopic = "/test/2/waku-filter";
    const newEncoder = createEncoder({ contentTopic: newContentTopic });
    const newDecoder = createDecoder(newContentTopic);
    await subscription.subscribe([newDecoder], messageCollector.callback);
    await waku.lightPush.send(newEncoder, {
      payload: utf8ToBytes(newMessageText)
    });
    expect(await messageCollector.waitForMessage()).to.eq(true);
    messageCollector.verifyReceivedMessage({
      expectedContentTopic: newContentTopic,
      expectedMessageText: newMessageText,
      index: 1
    });
    // Check that initial subscription still works
    await waku.lightPush.send(TestEncoder, newMessagePayload);
    expect(await messageCollector.waitForMessage()).to.eq(true);
    messageCollector.verifyReceivedMessage({
      expectedMessageText: newMessageText,
      index: 2
    });
    expect(messageCollector.count).to.eq(3);
    expect((await nwaku.messages()).length).to.eq(3);
  });

  it("Subscribe and receives messages on 20 topics", async function () {
    const topicCount = 20;
    const td = generateTestData(topicCount);
    // Set up the subscriptions and callback
    for (let i = 0; i < topicCount; i++) {
      await subscription.subscribe([td.decoders[i]], messageCollector.callback);
    }
    // Send messages on each topic
    for (let i = 0; i < topicCount; i++) {
      await waku.lightPush.send(td.encoders[i], {
        payload: utf8ToBytes(`Message for Topic ${i + 1}`)
      });
    }
    // Check if the messages were received
    await messageCollector.waitForMessage();
    td.contentTopics.forEach((topic, index) => {
      messageCollector.verifyReceivedMessage({
        expectedContentTopic: topic,
        expectedMessageText: `Message for Topic ${index + 1}`,
        index: index
      });
    });
    expect(messageCollector.count).to.eq(20);
  });

  it("Subscribe to 30 topics at once and receives messages", async function () {
    const topicCount = 30;
    const td = generateTestData(topicCount);
    await subscription.subscribe(td.decoders, messageCollector.callback);
    // Send messages on each topic
    for (let i = 0; i < topicCount; i++) {
      await waku.lightPush.send(td.encoders[i], {
        payload: utf8ToBytes(`Message for Topic ${i + 1}`)
      });
    }
    // Check if the messages were received
    await messageCollector.waitForMessage();
    td.contentTopics.forEach((topic, index) => {
      messageCollector.verifyReceivedMessage({
        expectedContentTopic: topic,
        expectedMessageText: `Message for Topic ${index + 1}`,
        index: index
      });
    });
    expect(messageCollector.count).to.eq(30);
  });

  it("Error when try to subscribe to more than 30 topics", async function () {
    const topicCount = 31;
    const td = generateTestData(topicCount);
    try {
      await subscription.subscribe(td.decoders, messageCollector.callback);
      throw new Error(
        "Subscribe to 31 topics was successful but was expected to fail with a specific error."
      );
    } catch (err) {
      if (
        err instanceof Error &&
        err.message.includes(
          "400: BAD_REQUEST: exceeds maximum content topics: 30"
        )
      ) {
        return;
      } else {
        throw err;
      }
    }
  });

  it("Overlapping topic subscription", async function () {
    const topicCount1 = 2;
    const td1 = generateTestData(topicCount1);
    const topicCount2 = 4;
    const td2 = generateTestData(topicCount2);
    // the first 2 topic are the same on each subscribe call
    await subscription.subscribe(td1.decoders, messageCollector.callback);
    await subscription.subscribe(td2.decoders, messageCollector.callback);
    // send messages on each topic
    for (let i = 0; i < topicCount1; i++) {
      const messageText = `Message for Topic ${i + 1}`;
      await waku.lightPush.send(td1.encoders[i], {
        payload: utf8ToBytes(messageText)
      });
    }
    for (let i = 0; i < topicCount2; i++) {
      const messageText = `Message for Topic ${i + 1}`;
      await waku.lightPush.send(td2.encoders[i], {
        payload: utf8ToBytes(messageText)
      });
    }
    // check all 6 messages were received
    await messageCollector.waitForMessage();
    expect(messageCollector.count).to.eq(6);
  });

  it("Refresh subscription", async function () {
    await subscription.subscribe([TestDecoder], messageCollector.callback);
    await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M1") });
    await subscription.subscribe([TestDecoder], messageCollector.callback);
    await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M2") });
    expect(await messageCollector.waitForMessage()).to.eq(true);
    messageCollector.verifyReceivedMessage({
      index: 0,
      expectedMessageText: "M1"
    });
    messageCollector.verifyReceivedMessage({
      index: 1,
      expectedMessageText: "M2"
    });
    expect(messageCollector.count).to.eq(2);
  });

  testStrings.forEach((testItem) => {
    it(`Subscribe to topic containing ${testItem.description} and receive message`, async function () {
      const newContentTopic = testItem.value;
      const newEncoder = createEncoder({ contentTopic: newContentTopic });
      const newDecoder = createDecoder(newContentTopic);
      await subscription.subscribe([newDecoder], messageCollector.callback);
      await waku.lightPush.send(newEncoder, messagePayload);
      expect(await messageCollector.waitForMessage()).to.eq(true);
      messageCollector.verifyReceivedMessage({
        index: 0,
        expectedContentTopic: newContentTopic
      });
      expect(messageCollector.count).to.eq(1);
    });
  });

  it("Add multiple subscribtions object on single nwaku node", async function () {
    await subscription.subscribe([TestDecoder], messageCollector.callback);
    await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M1") });
    const subscription2 = await waku.filter.createSubscription();
    const newContentTopic = "/test/2/waku-filter";
    const newEncoder = createEncoder({ contentTopic: newContentTopic });
    const newDecoder = createDecoder(newContentTopic);
    await subscription2.subscribe([newDecoder], messageCollector.callback);
    await waku.lightPush.send(newEncoder, { payload: utf8ToBytes("M2") });
    expect(await messageCollector.waitForMessage()).to.eq(true);
    messageCollector.verifyReceivedMessage({
      index: 0,
      expectedMessageText: "M1"
    });
    messageCollector.verifyReceivedMessage({
      index: 1,
      expectedContentTopic: newContentTopic,
      expectedMessageText: "M2"
    });
    expect(messageCollector.count).to.eq(2);
  });

  // this test fail 50% of times with messageCount beeing 1. Seems like a message is lost somehow
  it.skip("Subscribe and receive messages from multiple nwaku nodes", async function () {
    await subscription.subscribe([TestDecoder], messageCollector.callback);
    await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M1") });
    expect(await messageCollector.waitForMessage()).to.eq(true);
    // set up a new nwaku node
    nwaku2 = new NimGoNode(makeLogFileName(this) + "2");
    await nwaku2.start({
      filter: true,
      lightpush: true,
      relay: true
    });
    // connect js-waku to the new nwaku node and create a new subscription
    await waku.dial(await nwaku2.getMultiaddrWithId());
    await waitForRemotePeer(waku, [Protocols.Filter, Protocols.LightPush]);
    const subscription2 = await waku.filter.createSubscription(
      DefaultPubSubTopic,
      await nwaku2.getPeerId()
    );
    // send message on the new subscription
    const newContentTopic = "/test/2/waku-filter";
    const newEncoder = createEncoder({ contentTopic: newContentTopic });
    const newDecoder = createDecoder(newContentTopic);
    await subscription2.subscribe([newDecoder], messageCollector.callback);
    await waku.lightPush.send(newEncoder, { payload: utf8ToBytes("M2") });
    expect(await messageCollector.waitForMessage()).to.eq(true);
    messageCollector.verifyReceivedMessage({
      index: 0,
      expectedMessageText: "M1"
    });
    messageCollector.verifyReceivedMessage({
      index: 1,
      expectedContentTopic: newContentTopic,
      expectedMessageText: "M2"
    });
    expect(messageCollector.count).to.eq(2);
  });

  testStrings.forEach((testItem) => {
    it(`Check receive message containing ${testItem.description}`, async function () {
      await subscription.subscribe([TestDecoder], messageCollector.callback);
      await waku.lightPush.send(TestEncoder, {
        payload: utf8ToBytes(testItem.value)
      });
      expect(await messageCollector.waitForMessage()).to.eq(true);
      messageCollector.verifyReceivedMessage({
        index: 0,
        expectedMessageText: testItem.value
      });
      expect(messageCollector.count).to.eq(1);
    });
  });

  testTimestamps.forEach((testItem) => {
    it(`Check received message with timestamp: ${testItem} `, async function () {
      await subscription.subscribe([TestDecoder], messageCollector.callback);
      await delay(400);
      await nwaku.rpcCall("post_waku_v2_relay_v1_message", [
        DefaultPubSubTopic,
        {
          contentTopic: TestContentTopic,
          payload: Buffer.from(utf8ToBytes(messageText)).toString("base64"),
          timestamp: testItem
        }
      ]);
      expect(await messageCollector.waitForMessage()).to.eq(true);
      messageCollector.verifyReceivedMessage({
        index: 0,
        checkTimestamp: false
      });
      expect(messageCollector.count).to.eq(1);
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
    await nwaku.rpcCall("post_waku_v2_relay_v1_message", [
      DefaultPubSubTopic,
      {
        contentTopic: TestContentTopic,
        payload: Buffer.from(utf8ToBytes(messageText)).toString("base64"),
        timestamp: "2023-09-06T12:05:38.609Z"
      }
    ]);
    expect(await messageCollector.waitForMessage()).to.eq(false);
    expect(messageCollector.count).to.eq(0);
  });

  it("Check message on other pubsub topic is not received", async function () {
    await subscription.subscribe([TestDecoder], messageCollector.callback);
    await delay(400);
    await nwaku.rpcCall("post_waku_v2_relay_v1_message", [
      "DefaultPubSubTopic",
      {
        contentTopic: TestContentTopic,
        payload: Buffer.from(utf8ToBytes(messageText)).toString("base64"),
        timestamp: BigInt(Date.now()) * BigInt(1000000)
      }
    ]);
    expect(await messageCollector.waitForMessage()).to.eq(false);
    expect(messageCollector.count).to.eq(0);
  });

  it("Check message with no pubsub topic is not received", async function () {
    await subscription.subscribe([TestDecoder], messageCollector.callback);
    await delay(400);
    await nwaku.rpcCall("post_waku_v2_relay_v1_message", [
      {
        contentTopic: TestContentTopic,
        payload: Buffer.from(utf8ToBytes(messageText)).toString("base64"),
        timestamp: BigInt(Date.now()) * BigInt(1000000)
      }
    ]);
    expect(await messageCollector.waitForMessage()).to.eq(false);
    expect(messageCollector.count).to.eq(0);
  });

  it("Check message with no content topic is not received", async function () {
    await subscription.subscribe([TestDecoder], messageCollector.callback);
    await delay(400);
    await nwaku.rpcCall("post_waku_v2_relay_v1_message", [
      DefaultPubSubTopic,
      {
        payload: Buffer.from(utf8ToBytes(messageText)).toString("base64"),
        timestamp: BigInt(Date.now()) * BigInt(1000000)
      }
    ]);
    expect(await messageCollector.waitForMessage()).to.eq(false);
    expect(messageCollector.count).to.eq(0);
  });

  it("Check message with no payload is not received", async function () {
    await subscription.subscribe([TestDecoder], messageCollector.callback);
    await delay(400);
    await nwaku.rpcCall("post_waku_v2_relay_v1_message", [
      DefaultPubSubTopic,
      {
        contentTopic: TestContentTopic,
        timestamp: BigInt(Date.now()) * BigInt(1000000)
      }
    ]);
    expect(await messageCollector.waitForMessage()).to.eq(false);
    expect(messageCollector.count).to.eq(0);
  });

  it("Check message with non string payload is not received", async function () {
    await subscription.subscribe([TestDecoder], messageCollector.callback);
    await delay(400);
    await nwaku.rpcCall("post_waku_v2_relay_v1_message", [
      DefaultPubSubTopic,
      {
        contentTopic: TestContentTopic,
        payload: 12345,
        timestamp: BigInt(Date.now()) * BigInt(1000000)
      }
    ]);
    expect(await messageCollector.waitForMessage()).to.eq(false);
    expect(messageCollector.count).to.eq(0);
  });

  it("Check message with extra parameter is not received", async function () {
    await subscription.subscribe([TestDecoder], messageCollector.callback);
    await delay(400);
    await nwaku.rpcCall("post_waku_v2_relay_v1_message", [
      DefaultPubSubTopic,
      "extraField",
      {
        contentTopic: TestContentTopic,
        payload: Buffer.from(utf8ToBytes(messageText)).toString("base64"),
        timestamp: BigInt(Date.now()) * BigInt(1000000)
      }
    ]);
    expect(await messageCollector.waitForMessage()).to.eq(false);
    expect(messageCollector.count).to.eq(0);
  });

  it("Check message with extra option is received", async function () {
    await subscription.subscribe([TestDecoder], messageCollector.callback);
    await delay(400);
    await nwaku.rpcCall("post_waku_v2_relay_v1_message", [
      DefaultPubSubTopic,
      {
        contentTopic: TestContentTopic,
        payload: Buffer.from(utf8ToBytes(messageText)).toString("base64"),
        timestamp: BigInt(Date.now()) * BigInt(1000000),
        extraOption: "extraOption"
      }
    ]);
    expect(await messageCollector.waitForMessage()).to.eq(true);
    messageCollector.verifyReceivedMessage({ index: 0 });
    expect(messageCollector.count).to.eq(1);
  });

  // Will be skipped until https://github.com/waku-org/js-waku/issues/1464 si done
  it.skip("Check message received after jswaku node is restarted", async function () {
    await subscription.subscribe([TestDecoder], messageCollector.callback);
    await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M1") });
    expect(await messageCollector.waitForMessage()).to.eq(true);
    // restart js-waku node
    await waku.stop();
    expect(waku.isStarted()).to.eq(false);
    await waku.start();
    expect(waku.isStarted()).to.eq(true);
    // redo the connection and create a new subscription
    await waku.dial(await nwaku.getMultiaddrWithId());
    await waitForRemotePeer(waku, [Protocols.Filter, Protocols.LightPush]);
    subscription = await waku.filter.createSubscription();
    await subscription.subscribe([TestDecoder], messageCollector.callback);
    // resend message
    await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M2") });
    expect(await messageCollector.waitForMessage()).to.eq(true);
    messageCollector.verifyReceivedMessage({
      index: 0,
      expectedMessageText: "M1"
    });
    messageCollector.verifyReceivedMessage({
      index: 1,
      expectedMessageText: "M2"
    });
    expect(messageCollector.count).to.eq(2);
  });

  // Will be skipped until https://github.com/waku-org/js-waku/issues/1464 si done
  it.skip("Check message received after nwaku node is restarted", async function () {
    await subscription.subscribe([TestDecoder], messageCollector.callback);
    await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M1") });
    expect(await messageCollector.waitForMessage()).to.eq(true);
    // restart nwaku node
    await nwaku.stop();
    await nwaku.start();
    await waitForRemotePeer(waku, [Protocols.Filter, Protocols.LightPush]);
    // redsend message
    await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M2") });
    expect(await messageCollector.waitForMessage()).to.eq(true);
    messageCollector.verifyReceivedMessage({
      index: 0,
      expectedMessageText: "M1"
    });
    messageCollector.verifyReceivedMessage({
      index: 1,
      expectedMessageText: "M2"
    });
    expect(messageCollector.count).to.eq(2);
  });

  it("Ping on subscribed peer", async function () {
    await subscription.subscribe([TestDecoder], messageCollector.callback);
    await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M1") });
    expect(await messageCollector.waitForMessage()).to.eq(true);
    //if ping is successfull(node has active subscription) we receive a success status code
    await subscription.ping();
    await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M2") });
    expect(await messageCollector.waitForMessage()).to.eq(true);
    expect(messageCollector.count).to.eq(2);
  });

  it("Ping on peer without subscriptions", async function () {
    await validatePingError(subscription);
  });

  it("ping on unsubscribed peer", async function () {
    await subscription.subscribe([TestDecoder], messageCollector.callback);
    await subscription.ping();
    await subscription.unsubscribe([TestContentTopic]);
    await validatePingError(subscription);
  });

  it("Unsubscribe 1 topic - node subscribed to 1 topic", async function () {
    await subscription.subscribe([TestDecoder], messageCollector.callback);
    await waku.lightPush.send(TestEncoder, messagePayload);
    expect(await messageCollector.waitForMessage()).to.eq(true);
    messageCollector.reset_message_received_flag();
    await subscription.unsubscribe([TestContentTopic]);
    await waku.lightPush.send(TestEncoder, {
      payload: utf8ToBytes("Will not arrive")
    });
    expect(await messageCollector.waitForMessage()).to.eq(false);
    // check that from 2 messages send only the 1st was received
    messageCollector.verifyReceivedMessage({ index: 0 });
    expect(messageCollector.count).to.eq(1);
    expect((await nwaku.messages()).length).to.eq(2);
  });

  it("Unsubscribe 1 topic - node subscribed to 2 topics", async function () {
    // send messages on 2 topics
    await subscription.subscribe([TestDecoder], messageCollector.callback);
    const newContentTopic = "/test/2/waku-filter";
    const newEncoder = createEncoder({ contentTopic: newContentTopic });
    const newDecoder = createDecoder(newContentTopic);
    await subscription.subscribe([newDecoder], messageCollector.callback);
    await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M1") });
    await waku.lightPush.send(newEncoder, { payload: utf8ToBytes("M2") });
    expect(await messageCollector.waitForMessage()).to.eq(true);
    messageCollector.reset_message_received_flag();
    expect(messageCollector.count).to.eq(2);
    // unsubscribe from one and send again
    await subscription.unsubscribe([TestContentTopic]);
    await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M3") });
    expect(await messageCollector.waitForMessage()).to.eq(false);
    messageCollector.reset_message_received_flag();
    await waku.lightPush.send(newEncoder, { payload: utf8ToBytes("M4") });
    expect(await messageCollector.waitForMessage()).to.eq(true);
    messageCollector.reset_message_received_flag();
    // check that from 4 messages send 3 were received
    expect(messageCollector.count).to.eq(3);
    expect((await nwaku.messages()).length).to.eq(4);
  });

  it("Unsubscribe 2 topics - node subscribed to 2 topics", async function () {
    // send messages on 2 topics
    await subscription.subscribe([TestDecoder], messageCollector.callback);
    const newContentTopic = "/test/2/waku-filter";
    const newEncoder = createEncoder({ contentTopic: newContentTopic });
    const newDecoder = createDecoder(newContentTopic);
    await subscription.subscribe([newDecoder], messageCollector.callback);
    await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M1") });
    await waku.lightPush.send(newEncoder, { payload: utf8ToBytes("M2") });
    expect(await messageCollector.waitForMessage()).to.eq(true);
    messageCollector.reset_message_received_flag();
    expect(messageCollector.count).to.eq(2);
    // unsubscribe from both and send again
    await subscription.unsubscribe([TestContentTopic, newContentTopic]);
    await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M3") });
    await waku.lightPush.send(newEncoder, { payload: utf8ToBytes("M4") });
    expect(await messageCollector.waitForMessage()).to.eq(false);
    expect(messageCollector.count).to.eq(2);
    // check that from 4 messages send 3 were received
    expect((await nwaku.messages()).length).to.eq(4);
  });

  it("Unsubscribe topics the node is not subscribed to", async function () {
    // send a message
    await subscription.subscribe([TestDecoder], messageCollector.callback);
    await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M1") });
    expect(await messageCollector.waitForMessage()).to.eq(true);
    messageCollector.reset_message_received_flag();
    expect(messageCollector.count).to.eq(1);
    // unsubscribe from topics that we're not subscribed to and send again
    await subscription.unsubscribe([]);
    await subscription.unsubscribe(["/test/2/waku-filter"]);
    await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M2") });
    expect(await messageCollector.waitForMessage()).to.eq(true);
    // check that from 2 messages send only the 1st was received
    expect(messageCollector.count).to.eq(2);
    expect((await nwaku.messages()).length).to.eq(2);
  });

  it("Unsubscribes all - node subscribed to 1 topic", async function () {
    // send a message
    await subscription.subscribe([TestDecoder], messageCollector.callback);
    await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M1") });
    expect(await messageCollector.waitForMessage()).to.eq(true);
    messageCollector.reset_message_received_flag();
    expect(messageCollector.count).to.eq(1);
    // unsubscribe from all topics and send again
    await subscription.unsubscribeAll();
    await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M2") });
    expect(await messageCollector.waitForMessage()).to.eq(false);
    // check that from 2 messages send only the 1st was received
    expect(messageCollector.count).to.eq(1);
    expect((await nwaku.messages()).length).to.eq(2);
  });

  it("Unsubscribes all - node subscribed to 10 topics", async function () {
    // send messages on 10 topics
    const topicCount = 10;
    const td = generateTestData(topicCount);
    await subscription.subscribe(td.decoders, messageCollector.callback);
    for (let i = 0; i < topicCount; i++) {
      await waku.lightPush.send(td.encoders[i], {
        payload: utf8ToBytes(`M${i + 1}`)
      });
    }
    expect(await messageCollector.waitForMessage()).to.eq(true);
    messageCollector.reset_message_received_flag();
    expect(messageCollector.count).to.eq(10);
    // unsubscribe from all topics and send again
    await subscription.unsubscribeAll();
    for (let i = 0; i < topicCount; i++) {
      await waku.lightPush.send(td.encoders[i], {
        payload: utf8ToBytes(`M${topicCount + i + 1}`)
      });
    }
    expect(await messageCollector.waitForMessage()).to.eq(false);
    // check that from 20 messages send only 10 were received
    expect(messageCollector.count).to.eq(10);
    expect((await nwaku.messages()).length).to.eq(20);
  });
});

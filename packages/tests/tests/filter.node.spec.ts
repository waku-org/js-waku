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

let messageCount: number;
const msgCountCallback = (): void => {
  messageCount++;
};

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

// Creates a promise that will resolve when a message is received on the given subscription.
function getMessageOnSubscription(
  decoder: Decoder,
  subscription: IFilterSubscription,
  messageCount: number = 0
): Promise<{ message: DecodedMessage; messageCount: number }> {
  return new Promise<{ message: DecodedMessage; messageCount: number }>(
    (resolve) => {
      const callback = (msg: DecodedMessage): void => {
        messageCount += 1;
        resolve({ message: msg, messageCount: messageCount });
        log("Got a message");
      };
      void subscription.subscribe([decoder], callback);
    }
  );
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

describe.only("Waku Filter: V2", function () {
  // Set the timeout for all tests in this suite. Can be overwritten at test level
  this.timeout(10000);
  let waku: LightNode;
  let nwaku: NimGoNode;
  let nwaku2: NimGoNode;
  let subscription: IFilterSubscription;

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
    messageCount = 0;
  });

  it("Subscribe and receive messages via lightPush", async function () {
    const messagePromise = getMessageOnSubscription(TestDecoder, subscription);

    await waku.lightPush.send(TestEncoder, {
      payload: utf8ToBytes(messageText)
    });

    const { message, messageCount } = await messagePromise;

    expect(message.contentTopic).to.eq(TestContentTopic);
    expect(message.pubSubTopic).to.eq(DefaultPubSubTopic);
    expect(bytesToUtf8(message.payload)).to.eq(messageText);
    expect(message.version).to.eq(0);
    const timestamp = message.timestamp;
    if (timestamp !== undefined) {
      const now = Date.now();
      const tenSecondsAgo = now - 10000;
      expect(timestamp.getTime()).to.be.within(tenSecondsAgo, now);
    }
    expect(message.meta).to.eql(new Uint8Array(0));
    expect(message.ephemeral).to.be.false;
    expect(messageCount).to.eq(1);
    expect((await nwaku.messages()).length).to.eq(1);
  });

  it("Subscribe and receive messages via waku relay post", async function () {
    const messagePromise = getMessageOnSubscription(TestDecoder, subscription);

    await delay(400);

    await nwaku.sendMessage(
      NimGoNode.toMessageRpcQuery({
        contentTopic: TestContentTopic,
        payload: utf8ToBytes(messageText)
      })
    );

    const { message, messageCount } = await messagePromise;

    expect(message.contentTopic).to.eq(TestContentTopic);
    expect(message.pubSubTopic).to.eq(DefaultPubSubTopic);
    expect(bytesToUtf8(message.payload)).to.eq(messageText);
    expect(message.version).to.eq(0);
    const timestamp = message.timestamp;
    if (timestamp !== undefined) {
      const now = Date.now();
      const tenSecondsAgo = now - 10000;
      expect(timestamp.getTime()).to.be.within(tenSecondsAgo, now);
    }
    expect(message.meta).to.eql(new Uint8Array(0));
    expect(message.ephemeral).to.be.false;
    expect(messageCount).to.eq(1);
    expect((await nwaku.messages()).length).to.eq(1);
  });

  it("Subscribe and receive 2 messages on the same topic", async function () {
    let messagePromise = getMessageOnSubscription(TestDecoder, subscription);

    await waku.lightPush.send(TestEncoder, {
      payload: utf8ToBytes(messageText)
    });

    let { message, messageCount: msgCount } = await messagePromise;
    expect(bytesToUtf8(message.payload)).to.eq(messageText);
    expect(msgCount).to.eq(1);

    const newMessageText = "Filtering still works!";

    messagePromise = getMessageOnSubscription(
      TestDecoder,
      subscription,
      msgCount
    );

    await waku.lightPush.send(TestEncoder, {
      payload: utf8ToBytes(newMessageText)
    });

    ({ message, messageCount: msgCount } = await messagePromise);
    expect(bytesToUtf8(message.payload)).to.eq(newMessageText);
    expect(msgCount).to.eq(2);
    expect((await nwaku.messages()).length).to.eq(2);
  });

  it("Subscribe and receive messages on 2 different content topics", async function () {
    let messagePromise = getMessageOnSubscription(TestDecoder, subscription);

    await waku.lightPush.send(TestEncoder, {
      payload: utf8ToBytes(messageText)
    });

    let { message, messageCount: msgCount } = await messagePromise;

    expect(message.contentTopic).to.eq(TestContentTopic);
    expect(bytesToUtf8(message.payload)).to.eq(messageText);

    // Modify subscription
    const newMessageText = "Filtering still works!";
    const newMessagePayload = { payload: utf8ToBytes(newMessageText) };

    const newContentTopic = "/test/2/waku-filter";
    const newEncoder = createEncoder({ contentTopic: newContentTopic });
    const newDecoder = createDecoder(newContentTopic);

    messagePromise = getMessageOnSubscription(
      newDecoder,
      subscription,
      msgCount
    );

    await waku.lightPush.send(newEncoder, newMessagePayload);

    ({ message, messageCount: msgCount } = await messagePromise);

    expect(message.contentTopic).to.eq(newContentTopic);
    expect(bytesToUtf8(message.payload)).to.eq(newMessageText);

    // Check that initial subscription still works
    messagePromise = getMessageOnSubscription(
      TestDecoder,
      subscription,
      msgCount
    );

    await waku.lightPush.send(TestEncoder, newMessagePayload);

    ({ message, messageCount: msgCount } = await messagePromise);

    expect(message.contentTopic).to.eq(TestContentTopic);
    expect(bytesToUtf8(message.payload)).to.eq(newMessageText);
    expect(msgCount).to.eq(3);
    expect((await nwaku.messages()).length).to.eq(3);
  });

  it("Subscribe and receives messages on 20 topics", async function () {
    const topicCount = 20;
    const td = generateTestData(topicCount);
    const messagesReceived: { [key: string]: boolean } = {};

    // Set up the subscriptions
    for (let i = 0; i < topicCount; i++) {
      const messageText = `Message for Topic ${i + 1}`;
      const callback = (msg: DecodedMessage): void => {
        if (bytesToUtf8(msg.payload) === messageText) {
          messagesReceived[td.contentTopics[i]] = true;
        }
      };
      await subscription.subscribe([td.decoders[i]], callback);
    }

    // Send messages on each topic
    for (let i = 0; i < topicCount; i++) {
      const messageText = `Message for Topic ${i + 1}`;
      await waku.lightPush.send(td.encoders[i], {
        payload: utf8ToBytes(messageText)
      });
    }
    await delay(200);

    // Check if the messages were received
    td.contentTopics.forEach((topic) => {
      expect(messagesReceived[topic]).to.be.true;
    });
  });

  it("Subscribe to 30 topics at once and receives messages", async function () {
    const topicCount = 30;
    const td = generateTestData(topicCount);

    await subscription.subscribe(td.decoders, msgCountCallback);

    // Send messages on each topic
    for (let i = 0; i < topicCount; i++) {
      const messageText = `Message for Topic ${i + 1}`;
      await waku.lightPush.send(td.encoders[i], {
        payload: utf8ToBytes(messageText)
      });
    }
    await delay(200);
    expect(messageCount).to.eq(30);
  });

  it("Error when try to subscribe to more than 30 topics", async function () {
    const topicCount = 31;
    const td = generateTestData(topicCount);
    try {
      await subscription.subscribe(td.decoders, msgCountCallback);
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
    await subscription.subscribe(td1.decoders, msgCountCallback);
    await subscription.subscribe(td2.decoders, msgCountCallback);

    // Send messages on each topic
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
    await delay(200);

    expect(messageCount).to.eq(6);
  });

  it("Refresh subscription", async function () {
    await subscription.subscribe([TestDecoder], msgCountCallback);
    await delay(200);

    await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M1") });

    await subscription.subscribe([TestDecoder], msgCountCallback);
    await delay(200);

    await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M2") });
    await delay(200);

    expect(messageCount).to.eq(2);
  });

  testStrings.forEach((testItem) => {
    it(`Subscribe to ${testItem.description} topic and check receive message correctly`, async function () {
      const newContentTopic = testItem.value;
      const newEncoder = createEncoder({ contentTopic: newContentTopic });
      const newDecoder = createDecoder(newContentTopic);

      const messagePromise = getMessageOnSubscription(newDecoder, subscription);

      await waku.lightPush.send(newEncoder, {
        payload: utf8ToBytes(messageText)
      });

      const { message } = await messagePromise;
      expect(bytesToUtf8(message.payload)).to.eq(messageText);
    });
  });

  it.only("Subscribe and receive messages from multiple nwaku nodes", async function () {
    await subscription.subscribe([TestDecoder], msgCountCallback);
    await delay(200);

    await waku.lightPush.send(TestEncoder, {
      payload: utf8ToBytes("M1")
    });
    await delay(200);

    expect(messageCount).to.eq(1);

    nwaku2 = new NimGoNode(makeLogFileName(this) + "2");
    await nwaku2.start({
      filter: true,
      lightpush: true,
      relay: true
    });
    console.log(subscription);
    // console.log(await nwaku.getPeerId());
    // console.log(await nwaku.info());
    // console.log(await nwaku.getMultiaddrWithId());
    // console.log(await nwaku2.getPeerId());
    // console.log(await nwaku2.info());
    // console.log(await nwaku2.getMultiaddrWithId());

    await waku.dial(await nwaku2.getMultiaddrWithId());
    await delay(500);
    await waitForRemotePeer(waku, [Protocols.Filter, Protocols.LightPush]);
    const subscription2 = await waku.filter.createSubscription(
      DefaultPubSubTopic,
      await nwaku2.getPeerId()
    );

    const newContentTopic = "/test/2/waku-filter";
    const newEncoder = createEncoder({ contentTopic: newContentTopic });
    const newDecoder = createDecoder(newContentTopic);

    let messageCount2 = 0;
    const msgCountCallback2 = (): void => {
      messageCount2++;
    };

    await subscription2.subscribe([newDecoder], msgCountCallback2);
    await delay(200);

    await waku.lightPush.send(newEncoder, {
      payload: utf8ToBytes("M2")
    });
    await delay(200);
    console.log(messageCount);
    console.log(messageCount2);
    console.log(await nwaku.messages());
    console.log(await nwaku2.messages());
    expect(messageCount2).to.eq(1);
    expect((await nwaku.messages()).length).to.eq(1);
    expect((await nwaku2.messages()).length).to.eq(1);
  });

  testStrings.forEach((testItem) => {
    it(`Check receive ${testItem.description} message correctly`, async function () {
      const messagePromise = getMessageOnSubscription(
        TestDecoder,
        subscription
      );

      await waku.lightPush.send(TestEncoder, {
        payload: utf8ToBytes(testItem.value)
      });

      const { message } = await messagePromise;
      expect(bytesToUtf8(message.payload)).to.eq(testItem.value);
    });
  });

  testTimestamps.forEach((testItem) => {
    it(`Check received message with timestamp: ${testItem} `, async function () {
      const messagePromise = getMessageOnSubscription(
        TestDecoder,
        subscription
      );
      await delay(400);

      await nwaku.rpcCall("post_waku_v2_relay_v1_message", [
        DefaultPubSubTopic,
        {
          contentTopic: TestContentTopic,
          payload: Buffer.from(utf8ToBytes(messageText)).toString("base64"),
          timestamp: testItem
        }
      ]);

      const { message, messageCount } = await messagePromise;

      expect(message.contentTopic).to.eq(TestContentTopic);
      expect(message.pubSubTopic).to.eq(DefaultPubSubTopic);
      expect(bytesToUtf8(message.payload)).to.eq(messageText);
      expect(message.version).to.eq(0);
      const timestamp = message.timestamp;
      if (testItem == undefined) {
        expect(timestamp).to.eq(undefined);
      }
      if (timestamp !== undefined) {
        expect(testItem?.toString()).to.contain(timestamp.getTime().toString());
      }
      expect(message.meta).to.eql(new Uint8Array(0));
      expect(message.ephemeral).to.be.false;
      expect(messageCount).to.eq(1);
      expect((await nwaku.messages()).length).to.eq(1);
    });
  });

  it("Check message with invalid timestamp is not received", async function () {
    await subscription.subscribe([TestDecoder], msgCountCallback);
    await delay(400);

    await nwaku.rpcCall("post_waku_v2_relay_v1_message", [
      DefaultPubSubTopic,
      {
        contentTopic: TestContentTopic,
        payload: Buffer.from(utf8ToBytes(messageText)).toString("base64"),
        timestamp: "2023-09-06T12:05:38.609Z"
      }
    ]);

    await delay(200);
    expect(messageCount).to.eq(0);
  });

  it("Check message on other pubsub topic is not received", async function () {
    await subscription.subscribe([TestDecoder], msgCountCallback);
    await delay(400);

    await nwaku.rpcCall("post_waku_v2_relay_v1_message", [
      "DefaultPubSubTopic",
      {
        contentTopic: TestContentTopic,
        payload: Buffer.from(utf8ToBytes(messageText)).toString("base64"),
        timestamp: BigInt(Date.now()) * BigInt(1000000)
      }
    ]);

    await delay(200);
    expect(messageCount).to.eq(0);
  });

  it("Check message with no pubsub topic is not received", async function () {
    await subscription.subscribe([TestDecoder], msgCountCallback);
    await delay(400);

    await nwaku.rpcCall("post_waku_v2_relay_v1_message", [
      {
        contentTopic: TestContentTopic,
        payload: Buffer.from(utf8ToBytes(messageText)).toString("base64"),
        timestamp: BigInt(Date.now()) * BigInt(1000000)
      }
    ]);

    await delay(200);
    expect(messageCount).to.eq(0);
  });

  it("Check message with no content topic is not received", async function () {
    await subscription.subscribe([TestDecoder], msgCountCallback);
    await delay(400);

    await nwaku.rpcCall("post_waku_v2_relay_v1_message", [
      DefaultPubSubTopic,
      {
        payload: Buffer.from(utf8ToBytes(messageText)).toString("base64"),
        timestamp: BigInt(Date.now()) * BigInt(1000000)
      }
    ]);

    await delay(200);
    expect(messageCount).to.eq(0);
  });

  it("Check message with no payload is not received", async function () {
    await subscription.subscribe([TestDecoder], msgCountCallback);
    await delay(400);

    await nwaku.rpcCall("post_waku_v2_relay_v1_message", [
      DefaultPubSubTopic,
      {
        contentTopic: TestContentTopic,
        timestamp: BigInt(Date.now()) * BigInt(1000000)
      }
    ]);

    await delay(200);
    expect(messageCount).to.eq(0);
  });

  it("Check message with non string payload is not received", async function () {
    await subscription.subscribe([TestDecoder], msgCountCallback);
    await delay(400);

    await nwaku.rpcCall("post_waku_v2_relay_v1_message", [
      DefaultPubSubTopic,
      {
        contentTopic: TestContentTopic,
        payload: 12345,
        timestamp: BigInt(Date.now()) * BigInt(1000000)
      }
    ]);

    await delay(200);
    expect(messageCount).to.eq(0);
  });

  it("Check message with extra parameter is not received", async function () {
    await subscription.subscribe([TestDecoder], msgCountCallback);
    await delay(400);

    await nwaku.rpcCall("post_waku_v2_relay_v1_message", [
      DefaultPubSubTopic,
      "extraField1",
      {
        contentTopic: TestContentTopic,
        payload: Buffer.from(utf8ToBytes(messageText)).toString("base64"),
        timestamp: BigInt(Date.now()) * BigInt(1000000)
      }
    ]);

    await delay(200);
    expect(messageCount).to.eq(0);
  });

  // Will be skipped until https://github.com/waku-org/js-waku/issues/1464 si done
  it.skip("Check message received after jswaku node is restarted", async function () {
    await subscription.subscribe([TestDecoder], msgCountCallback);
    await delay(200);

    await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M1") });

    await delay(200);
    expect(messageCount).to.eq(1);
    await waku.stop();
    expect(waku.isStarted()).to.eq(false);
    await waku.start();
    expect(waku.isStarted()).to.eq(true);

    await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M2") });

    await delay(200);
    expect(messageCount).to.eq(2);
  });

  // Will be skipped until https://github.com/waku-org/js-waku/issues/1464 si done
  it.skip("Check message received after nwaku node is restarted", async function () {
    await subscription.subscribe([TestDecoder], msgCountCallback);
    await delay(200);

    await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M1") });

    await delay(200);
    expect(messageCount).to.eq(1);

    await nwaku.stop();
    await nwaku.start();
    await waitForRemotePeer(waku, [Protocols.Filter, Protocols.LightPush]);

    await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M2") });

    await delay(200);
    expect(messageCount).to.eq(2);
  });

  it("Ping on subscribed peer", async function () {
    await subscription.subscribe([TestDecoder], msgCountCallback);
    await delay(200);

    await waku.lightPush.send(TestEncoder, {
      payload: utf8ToBytes("This should be received")
    });
    await delay(100);

    //if ping is successfull(node has active subscription) we receive a success status code
    await subscription.ping();

    await waku.lightPush.send(TestEncoder, {
      payload: utf8ToBytes("This should also be received")
    });
    await delay(100);

    expect(messageCount).to.eq(2);
    expect((await nwaku.messages()).length).to.eq(2);
  });

  it("Ping on peer without subscriptions", async function () {
    await validatePingError(subscription);
  });

  it("ping on unsubscribed peer", async function () {
    await subscription.subscribe([TestDecoder], msgCountCallback);
    await delay(200);

    //if ping is successfull(node has active subscription) we receive a success status code
    await subscription.ping();

    await subscription.unsubscribe([TestContentTopic]);

    await validatePingError(subscription);
  });

  it("Unsubscribe 1 topic - node subscribed to 1 topic", async function () {
    await subscription.subscribe([TestDecoder], msgCountCallback);
    await delay(200);

    await waku.lightPush.send(TestEncoder, {
      payload: utf8ToBytes("This should be received")
    });
    await delay(100);
    expect(messageCount).to.eq(1);

    await subscription.unsubscribe([TestContentTopic]);

    await waku.lightPush.send(TestEncoder, {
      payload: utf8ToBytes("This should not be received")
    });
    await delay(100);

    // check that from 2 messages send only the 1st was received
    expect(messageCount).to.eq(1);
    expect((await nwaku.messages()).length).to.eq(2);
  });

  it("Unsubscribe 1 topic - node subscribed to 2 topics", async function () {
    await subscription.subscribe([TestDecoder], msgCountCallback);

    const newContentTopic = "/test/2/waku-filter";
    const newEncoder = createEncoder({ contentTopic: newContentTopic });
    const newDecoder = createDecoder(newContentTopic);
    await subscription.subscribe([newDecoder], msgCountCallback);
    await delay(200);

    await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M1") });
    await waku.lightPush.send(newEncoder, { payload: utf8ToBytes("M2") });
    await delay(200);
    expect(messageCount).to.eq(2);

    await subscription.unsubscribe([TestContentTopic]);

    await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M3") });
    await waku.lightPush.send(newEncoder, { payload: utf8ToBytes("M4") });
    await delay(200);

    // check that from 4 messages send 3 were received
    expect(messageCount).to.eq(3);
    expect((await nwaku.messages()).length).to.eq(4);
  });

  it("Unsubscribe 2 topics - node subscribed to 2 topics", async function () {
    await subscription.subscribe([TestDecoder], msgCountCallback);

    const newContentTopic = "/test/2/waku-filter";
    const newEncoder = createEncoder({ contentTopic: newContentTopic });
    const newDecoder = createDecoder(newContentTopic);
    await subscription.subscribe([newDecoder], msgCountCallback);
    await delay(200);

    await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M1") });
    await waku.lightPush.send(newEncoder, { payload: utf8ToBytes("M2") });
    await delay(200);
    expect(messageCount).to.eq(2);

    await subscription.unsubscribe([TestContentTopic, newContentTopic]);

    await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M3") });
    await waku.lightPush.send(newEncoder, { payload: utf8ToBytes("M4") });
    await delay(200);

    expect(messageCount).to.eq(2);
    // check that from 4 messages send 3 were received
    expect((await nwaku.messages()).length).to.eq(4);
  });

  it("Unsubscribe topics the node is not subscribed to", async function () {
    await subscription.subscribe([TestDecoder], msgCountCallback);
    await delay(200);

    await waku.lightPush.send(TestEncoder, {
      payload: utf8ToBytes("This should be received")
    });
    await delay(100);
    expect(messageCount).to.eq(1);

    await subscription.unsubscribe([]);
    await subscription.unsubscribe(["/test/2/waku-filter"]);

    await waku.lightPush.send(TestEncoder, {
      payload: utf8ToBytes("This should also be received")
    });
    await delay(100);

    // check that from 2 messages send only the 1st was received
    expect(messageCount).to.eq(2);
    expect((await nwaku.messages()).length).to.eq(2);
  });

  it("Unsubscribes all - node subscribed to 1 topic", async function () {
    await subscription.subscribe([TestDecoder], msgCountCallback);
    await delay(200);

    await waku.lightPush.send(TestEncoder, {
      payload: utf8ToBytes("This should be received")
    });
    await delay(100);

    await subscription.unsubscribeAll();
    expect(messageCount).to.eq(1);

    await waku.lightPush.send(TestEncoder, {
      payload: utf8ToBytes("This should not be received")
    });
    await delay(100);

    // check that from 2 messages send only the 1st was received
    expect(messageCount).to.eq(1);
    expect((await nwaku.messages()).length).to.eq(2);
  });

  it("Unsubscribes all - node subscribed to 10 topics", async function () {
    const topicCount = 10;
    const td = generateTestData(topicCount);
    await subscription.subscribe(td.decoders, msgCountCallback);
    await delay(200);

    for (let i = 0; i < topicCount; i++) {
      await waku.lightPush.send(td.encoders[i], {
        payload: utf8ToBytes(`M${i + 1}`)
      });
    }
    await delay(200);

    await subscription.unsubscribeAll();
    expect(messageCount).to.eq(topicCount);

    for (let i = 0; i < topicCount; i++) {
      await waku.lightPush.send(td.encoders[i], {
        payload: utf8ToBytes(`M${topicCount + i + 1}`)
      });
    }
    await delay(200);

    // check that from 20 messages send only 10 were received
    expect(messageCount).to.eq(10);
    expect((await nwaku.messages()).length).to.eq(20);
  });
});

import { createDecoder, createEncoder, waitForRemotePeer } from "@waku/core";
import {
  DefaultPubsubTopic,
  IFilterSubscription,
  LightNode,
  Protocols
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
  afterEachCustom,
  beforeEachCustom,
  delay,
  generateTestData,
  isNwakuAtLeast,
  makeLogFileName,
  MessageCollector,
  ServiceNode,
  tearDownNodes,
  TEST_STRING
} from "../../../src/index.js";
import {
  messagePayload,
  messageText,
  TestContentTopic,
  TestDecoder,
  TestEncoder
} from "../utils.js";

import { runNodes } from "./utils.js";

describe("Waku Filter V2: Subscribe: Single Service Node", function () {
  // Set the timeout for all tests in this suite. Can be overwritten at test level
  this.timeout(10000);
  let waku: LightNode;
  let nwaku: ServiceNode;
  let nwaku2: ServiceNode;
  let subscription: IFilterSubscription;
  let messageCollector: MessageCollector;

  beforeEachCustom(this, async () => {
    [nwaku, waku] = await runNodes(this.ctx, [DefaultPubsubTopic]);
    subscription = await waku.filter.createSubscription();
    messageCollector = new MessageCollector();
    await nwaku.ensureSubscriptions();
  });

  afterEachCustom(this, async () => {
    await tearDownNodes([nwaku, nwaku2], waku);
  });

  it("Subscribe and receive messages via lightPush", async function () {
    await subscription.subscribe([TestDecoder], messageCollector.callback);

    await waku.lightPush.send(TestEncoder, messagePayload);

    expect(await messageCollector.waitForMessages(1)).to.eq(true);
    messageCollector.verifyReceivedMessage(0, {
      expectedMessageText: messageText,
      expectedContentTopic: TestContentTopic
    });
    expect((await nwaku.messages()).length).to.eq(1);
  });

  it("Subscribe and receive ecies encrypted messages via lightPush", async function () {
    const privateKey = generatePrivateKey();
    const publicKey = getPublicKey(privateKey);
    const encoder = ecies.createEncoder({
      contentTopic: TestContentTopic,
      publicKey
    });
    const decoder = ecies.createDecoder(TestContentTopic, privateKey);

    await subscription.subscribe([decoder], messageCollector.callback);

    await waku.lightPush.send(encoder, messagePayload);

    expect(await messageCollector.waitForMessages(1)).to.eq(true);
    messageCollector.verifyReceivedMessage(0, {
      expectedMessageText: messageText,
      expectedContentTopic: TestContentTopic,
      expectedVersion: 1
    });
    expect((await nwaku.messages()).length).to.eq(1);
  });

  it("Subscribe and receive symmetrically encrypted messages via lightPush", async function () {
    const symKey = generateSymmetricKey();
    const encoder = symmetric.createEncoder({
      contentTopic: TestContentTopic,
      symKey
    });
    const decoder = symmetric.createDecoder(TestContentTopic, symKey);

    await subscription.subscribe([decoder], messageCollector.callback);

    await waku.lightPush.send(encoder, messagePayload);

    expect(await messageCollector.waitForMessages(1)).to.eq(true);
    messageCollector.verifyReceivedMessage(0, {
      expectedMessageText: messageText,
      expectedContentTopic: TestContentTopic,
      expectedVersion: 1
    });
    expect((await nwaku.messages()).length).to.eq(1);
  });

  it("Subscribe and receive messages via waku relay post", async function () {
    await subscription.subscribe([TestDecoder], messageCollector.callback);

    await delay(400);

    // Send a test message using the relay post method.
    await nwaku.sendMessage(
      ServiceNode.toMessageRpcQuery({
        contentTopic: TestContentTopic,
        payload: utf8ToBytes(messageText)
      })
    );

    expect(await messageCollector.waitForMessages(1)).to.eq(true);
    messageCollector.verifyReceivedMessage(0, {
      expectedMessageText: messageText,
      expectedContentTopic: TestContentTopic
    });
    expect((await nwaku.messages()).length).to.eq(1);
  });

  it("Subscribe and receive 2 messages on the same topic", async function () {
    await subscription.subscribe([TestDecoder], messageCollector.callback);

    await waku.lightPush.send(TestEncoder, messagePayload);

    expect(await messageCollector.waitForMessages(1)).to.eq(true);
    messageCollector.verifyReceivedMessage(0, {
      expectedMessageText: messageText,
      expectedContentTopic: TestContentTopic
    });

    // Send another message on the same topic.
    const newMessageText = "Filtering still works!";
    await waku.lightPush.send(TestEncoder, {
      payload: utf8ToBytes(newMessageText)
    });

    // Verify that the second message was successfully received.
    expect(await messageCollector.waitForMessages(2)).to.eq(true);
    messageCollector.verifyReceivedMessage(1, {
      expectedMessageText: newMessageText,
      expectedContentTopic: TestContentTopic
    });
    expect((await nwaku.messages()).length).to.eq(2);
  });

  it("Subscribe and receive messages on 2 different content topics", async function () {
    // Subscribe to the first content topic and send a message.
    await subscription.subscribe([TestDecoder], messageCollector.callback);
    await waku.lightPush.send(TestEncoder, messagePayload);
    expect(await messageCollector.waitForMessages(1)).to.eq(true);
    messageCollector.verifyReceivedMessage(0, {
      expectedMessageText: messageText,
      expectedContentTopic: TestContentTopic
    });

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
    messageCollector.verifyReceivedMessage(1, {
      expectedContentTopic: newContentTopic,
      expectedMessageText: newMessageText
    });

    // Send another message on the initial content topic to verify it still works.
    await waku.lightPush.send(TestEncoder, newMessagePayload);
    expect(await messageCollector.waitForMessages(3)).to.eq(true);
    messageCollector.verifyReceivedMessage(2, {
      expectedMessageText: newMessageText,
      expectedContentTopic: TestContentTopic
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
      messageCollector.verifyReceivedMessage(index, {
        expectedContentTopic: topic,
        expectedMessageText: `Message for Topic ${index + 1}`
      });
    });
  });

  it("Subscribe to 100 topics (new limit) at once and receives messages", async function () {
    let topicCount: number;
    if (isNwakuAtLeast("0.25.0")) {
      this.timeout(50000);
      topicCount = 100;
    } else {
      // skipping for old versions where the limit is 30
      this.skip();
    }
    const td = generateTestData(topicCount);

    await subscription.subscribe(td.decoders, messageCollector.callback);

    // Send a unique message on each topic.
    for (let i = 0; i < topicCount; i++) {
      await waku.lightPush.send(td.encoders[i], {
        payload: utf8ToBytes(`Message for Topic ${i + 1}`)
      });
    }

    // Open issue here: https://github.com/waku-org/js-waku/issues/1790
    // That's why we use the try catch block
    try {
      // Verify that each message was received on the corresponding topic.
      expect(await messageCollector.waitForMessages(topicCount)).to.eq(true);
      td.contentTopics.forEach((topic, index) => {
        messageCollector.verifyReceivedMessage(index, {
          expectedContentTopic: topic,
          expectedMessageText: `Message for Topic ${index + 1}`
        });
      });
    } catch (error) {
      console.warn(
        "This test still fails because of https://github.com/waku-org/js-waku/issues/1790"
      );
    }
  });

  //TODO: remove test when WAKUNODE_IMAGE is 0.25.0
  it("Subscribe to 30 topics (old limit) at once and receives messages", async function () {
    let topicCount: number;
    if (isNwakuAtLeast("0.25.0")) {
      // skipping for new versions where the new limit is 100
      this.skip();
    } else {
      topicCount = 30;
    }

    const td = generateTestData(topicCount);

    await subscription.subscribe(td.decoders, messageCollector.callback);

    // Send a unique message on each topic.
    for (let i = 0; i < topicCount; i++) {
      await waku.lightPush.send(td.encoders[i], {
        payload: utf8ToBytes(`Message for Topic ${i + 1}`)
      });
    }

    // Open issue here: https://github.com/waku-org/js-waku/issues/1790
    // That's why we use the try catch block
    try {
      // Verify that each message was received on the corresponding topic.
      expect(await messageCollector.waitForMessages(topicCount)).to.eq(true);
      td.contentTopics.forEach((topic, index) => {
        messageCollector.verifyReceivedMessage(index, {
          expectedContentTopic: topic,
          expectedMessageText: `Message for Topic ${index + 1}`
        });
      });
    } catch (error) {
      console.warn(
        "This test still fails because of https://github.com/waku-org/js-waku/issues/1790"
      );
    }
  });

  it("Error when try to subscribe to more than 101 topics (new limit)", async function () {
    let topicCount: number;
    if (isNwakuAtLeast("0.25.0")) {
      topicCount = 101;
    } else {
      // skipping for old versions where the limit is 30
      this.skip();
    }
    const td = generateTestData(topicCount);

    try {
      await subscription.subscribe(td.decoders, messageCollector.callback);
      throw new Error(
        `Subscribe to ${topicCount} topics was successful but was expected to fail with a specific error.`
      );
    } catch (err) {
      if (
        err instanceof Error &&
        err.message.includes(
          `exceeds maximum content topics: ${topicCount - 1}`
        )
      ) {
        return;
      } else {
        throw err;
      }
    }
  });

  //TODO: remove test when WAKUNODE_IMAGE is 0.25.0
  it("Error when try to subscribe to more than 31 topics (old limit)", async function () {
    let topicCount: number;
    if (isNwakuAtLeast("0.25.0")) {
      // skipping for new versions where the new limit is 100
      this.skip();
    } else {
      topicCount = 31;
    }
    const td = generateTestData(topicCount);

    try {
      await subscription.subscribe(td.decoders, messageCollector.callback);
      throw new Error(
        `Subscribe to ${topicCount} topics was successful but was expected to fail with a specific error.`
      );
    } catch (err) {
      if (
        err instanceof Error &&
        err.message.includes(
          `exceeds maximum content topics: ${topicCount - 1}`
        )
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
    expect(await messageCollector.waitForMessages(6, { exact: true })).to.eq(
      true
    );
  });

  it("Refresh subscription", async function () {
    await subscription.subscribe([TestDecoder], messageCollector.callback);
    await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M1") });

    // Resubscribe (refresh) to the same topic and send another message.
    await subscription.subscribe([TestDecoder], messageCollector.callback);
    await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M2") });

    // Confirm both messages were received.
    expect(await messageCollector.waitForMessages(2, { exact: true })).to.eq(
      true
    );
    messageCollector.verifyReceivedMessage(0, {
      expectedMessageText: "M1",
      expectedContentTopic: TestContentTopic
    });
    messageCollector.verifyReceivedMessage(1, {
      expectedMessageText: "M2",
      expectedContentTopic: TestContentTopic
    });
  });

  TEST_STRING.forEach((testItem) => {
    it(`Subscribe to topic containing ${testItem.description} and receive message`, async function () {
      const newContentTopic = testItem.value;
      const newEncoder = createEncoder({ contentTopic: newContentTopic });
      const newDecoder = createDecoder(newContentTopic);

      await subscription.subscribe([newDecoder], messageCollector.callback);
      await waku.lightPush.send(newEncoder, messagePayload);

      expect(await messageCollector.waitForMessages(1)).to.eq(true);
      messageCollector.verifyReceivedMessage(0, {
        expectedMessageText: messageText,
        expectedContentTopic: newContentTopic
      });
    });
  });

  it("Add multiple subscription objects on single nwaku node", async function () {
    await subscription.subscribe([TestDecoder], messageCollector.callback);
    await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M1") });

    // Create a second subscription on a different topic
    const subscription2 = await waku.filter.createSubscription();
    const newContentTopic = "/test/2/waku-filter";
    const newEncoder = createEncoder({ contentTopic: newContentTopic });
    const newDecoder = createDecoder(newContentTopic);
    await subscription2.subscribe([newDecoder], messageCollector.callback);

    await waku.lightPush.send(newEncoder, { payload: utf8ToBytes("M2") });

    // Check if both messages were received
    expect(await messageCollector.waitForMessages(2)).to.eq(true);
    messageCollector.verifyReceivedMessage(0, {
      expectedMessageText: "M1",
      expectedContentTopic: TestContentTopic
    });
    messageCollector.verifyReceivedMessage(1, {
      expectedContentTopic: newContentTopic,
      expectedMessageText: "M2"
    });
  });

  it("Subscribe and receive messages from multiple nwaku nodes", async function () {
    await subscription.subscribe([TestDecoder], messageCollector.callback);

    // Set up and start a new nwaku node
    nwaku2 = new ServiceNode(makeLogFileName(this) + "2");
    await nwaku2.start({
      filter: true,
      lightpush: true,
      relay: true
    });
    await waku.dial(await nwaku2.getMultiaddrWithId());
    await waitForRemotePeer(waku, [Protocols.Filter, Protocols.LightPush]);
    const subscription2 = await waku.filter.createSubscription(
      undefined,
      await nwaku2.getPeerId()
    );
    await nwaku2.ensureSubscriptions([DefaultPubsubTopic]);
    // Send a message using the new subscription
    const newContentTopic = "/test/2/waku-filter";
    const newEncoder = createEncoder({ contentTopic: newContentTopic });
    const newDecoder = createDecoder(newContentTopic);
    await subscription2.subscribe([newDecoder], messageCollector.callback);

    // Making sure that messages are send and reveiced for both subscriptions
    while (!(await messageCollector.waitForMessages(2))) {
      await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M1") });
      await waku.lightPush.send(newEncoder, { payload: utf8ToBytes("M2") });
    }

    // Check if both messages were received
    expect(messageCollector.hasMessage(TestContentTopic, "M1")).to.eq(true);
    expect(messageCollector.hasMessage(newContentTopic, "M2")).to.eq(true);
  });
});

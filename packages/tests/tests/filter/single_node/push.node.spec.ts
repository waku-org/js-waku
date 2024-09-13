import { waitForRemotePeer } from "@waku/core";
import { LightNode, Protocols } from "@waku/interfaces";
import { utf8ToBytes } from "@waku/sdk";
import { expect } from "chai";

import {
  afterEachCustom,
  beforeEachCustom,
  delay,
  MessageCollector,
  ServiceNode,
  tearDownNodes,
  TEST_STRING,
  TEST_TIMESTAMPS
} from "../../../src/index.js";
import { runNodes } from "../../light-push/utils.js";
import {
  messageText,
  TestContentTopic,
  TestDecoder,
  TestEncoder,
  TestPubsubTopic,
  TestShardInfo
} from "../utils.js";

describe("Waku Filter V2: FilterPush", function () {
  // Set the timeout for all tests in this suite. Can be overwritten at test level
  this.timeout(10000);
  let waku: LightNode;
  let nwaku: ServiceNode;
  let messageCollector: MessageCollector;

  beforeEachCustom(this, async () => {
    [nwaku, waku] = await runNodes(this.ctx, TestShardInfo);
    messageCollector = new MessageCollector(nwaku);
  });

  afterEachCustom(this, async () => {
    await tearDownNodes(nwaku, waku);
  });

  TEST_STRING.forEach((testItem) => {
    it(`Check received message containing ${testItem.description}`, async function () {
      await waku.filter.subscribe([TestDecoder], messageCollector.callback);
      await waku.lightPush.send(TestEncoder, {
        payload: utf8ToBytes(testItem.value)
      });

      expect(await messageCollector.waitForMessages(1)).to.eq(true);
      messageCollector.verifyReceivedMessage(0, {
        expectedMessageText: testItem.value,
        expectedContentTopic: TestContentTopic
      });
    });
  });

  TEST_TIMESTAMPS.forEach((testItem) => {
    it(`Check received message with timestamp: ${testItem} `, async function () {
      await waku.filter.subscribe([TestDecoder], messageCollector.callback);
      await delay(400);

      await nwaku.restCall<boolean>(
        `/relay/v1/messages/${encodeURIComponent(TestPubsubTopic)}`,
        "POST",
        {
          contentTopic: TestContentTopic,
          payload: Buffer.from(utf8ToBytes(messageText)).toString("base64"),
          timestamp: testItem,
          version: 0
        },
        async (res) => res.status === 200
      );

      expect(await messageCollector.waitForMessages(1)).to.eq(true);
      messageCollector.verifyReceivedMessage(0, {
        expectedMessageText: messageText,
        checkTimestamp: false,
        expectedContentTopic: TestContentTopic
      });

      // Check if the timestamp matches
      const timestamp = messageCollector.getMessage(0).timestamp;
      if (testItem == undefined) {
        expect(timestamp).to.eq(undefined);
      }
      if (timestamp !== undefined && timestamp instanceof Date) {
        expect(testItem?.toString()).to.contain(timestamp.getTime().toString());
      }
    });
  });

  it("Check message with invalid timestamp is not received", async function () {
    await waku.filter.subscribe([TestDecoder], messageCollector.callback);
    await delay(400);

    await nwaku.restCall<boolean>(
      `/relay/v1/messages/${encodeURIComponent(TestPubsubTopic)}`,
      "POST",
      {
        contentTopic: TestContentTopic,
        payload: Buffer.from(utf8ToBytes(messageText)).toString("base64"),
        timestamp: "2023-09-06T12:05:38.609Z"
      },
      async (res) => res.status === 200
    );

    // Verify that no message was received
    expect(await messageCollector.waitForMessages(1)).to.eq(false);
  });

  it("Check message on other pubsub topic is not received", async function () {
    await waku.filter.subscribe([TestDecoder], messageCollector.callback);
    await delay(400);

    await nwaku.restCall<boolean>(
      `/relay/v1/messages/${encodeURIComponent("/othertopic")}`,
      "POST",
      {
        contentTopic: TestContentTopic,
        payload: Buffer.from(utf8ToBytes(messageText)).toString("base64"),
        timestamp: BigInt(Date.now()) * BigInt(1000000)
      },
      async (res) => res.status === 200
    );

    expect(await messageCollector.waitForMessages(1)).to.eq(false);
  });

  it("Check message with no pubsub topic is not received", async function () {
    await waku.filter.subscribe([TestDecoder], messageCollector.callback);
    await delay(400);

    await nwaku.restCall<boolean>(
      `/relay/v1/messages/`,
      "POST",
      {
        contentTopic: TestContentTopic,
        payload: Buffer.from(utf8ToBytes(messageText)).toString("base64"),
        timestamp: BigInt(Date.now()) * BigInt(1000000)
      },
      async (res) => res.status === 200
    );

    expect(await messageCollector.waitForMessages(1)).to.eq(false);
  });

  it("Check message with no content topic is not received", async function () {
    await waku.filter.subscribe([TestDecoder], messageCollector.callback);
    await delay(400);

    await nwaku.restCall<boolean>(
      `/relay/v1/messages/${encodeURIComponent(TestPubsubTopic)}`,
      "POST",
      {
        payload: Buffer.from(utf8ToBytes(messageText)).toString("base64"),
        timestamp: BigInt(Date.now()) * BigInt(1000000)
      },
      async (res) => res.status === 200
    );

    expect(await messageCollector.waitForMessages(1)).to.eq(false);
  });

  it("Check message with no payload is not received", async function () {
    await waku.filter.subscribe([TestDecoder], messageCollector.callback);
    await delay(400);

    await nwaku.restCall<boolean>(
      `/relay/v1/messages/${encodeURIComponent(TestPubsubTopic)}`,
      "POST",
      {
        contentTopic: TestContentTopic,
        timestamp: BigInt(Date.now()) * BigInt(1000000)
      },
      async (res) => res.status === 200
    );

    // For go-waku the message is received (it is possible to send a message with no payload)
    if (nwaku.type == "go-waku") {
      expect(await messageCollector.waitForMessages(1)).to.eq(true);
    } else {
      expect(await messageCollector.waitForMessages(1)).to.eq(false);
    }
  });

  it("Check message with non string payload is not received", async function () {
    await waku.filter.subscribe([TestDecoder], messageCollector.callback);
    await delay(400);

    await nwaku.restCall<boolean>(
      `/relay/v1/messages/${encodeURIComponent(TestPubsubTopic)}`,
      "POST",
      {
        contentTopic: TestContentTopic,
        payload: 12345,
        timestamp: BigInt(Date.now()) * BigInt(1000000)
      },
      async (res) => res.status === 200
    );

    expect(await messageCollector.waitForMessages(1)).to.eq(false);
  });

  // Will be skipped until https://github.com/waku-org/js-waku/issues/1464 si done
  it.skip("Check message received after jswaku node is restarted", async function () {
    // Subscribe and send message
    await waku.filter.subscribe([TestDecoder], messageCollector.callback);
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

    await waku.filter.subscribe([TestDecoder], messageCollector.callback);

    await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M2") });

    // Confirm both messages were received.
    expect(await messageCollector.waitForMessages(2)).to.eq(true);
    messageCollector.verifyReceivedMessage(0, {
      expectedMessageText: "M1",
      expectedContentTopic: TestContentTopic
    });
    messageCollector.verifyReceivedMessage(1, {
      expectedMessageText: "M2",
      expectedContentTopic: TestContentTopic
    });
  });

  // Will be skipped until https://github.com/waku-org/js-waku/issues/1464 si done
  it.skip("Check message received after nwaku node is restarted", async function () {
    await waku.filter.subscribe([TestDecoder], messageCollector.callback);
    await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M1") });
    expect(await messageCollector.waitForMessages(1)).to.eq(true);

    // Restart nwaku node
    await tearDownNodes(nwaku, []);
    await nwaku.start();
    await waitForRemotePeer(waku, [Protocols.Filter, Protocols.LightPush]);

    await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M2") });

    // Confirm both messages were received.
    expect(await messageCollector.waitForMessages(2)).to.eq(true);
    messageCollector.verifyReceivedMessage(0, {
      expectedMessageText: "M1",
      expectedContentTopic: TestContentTopic
    });
    messageCollector.verifyReceivedMessage(1, {
      expectedMessageText: "M2",
      expectedContentTopic: TestContentTopic
    });
  });
});

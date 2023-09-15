import { createEncoder } from "@waku/core";
import { IRateLimitProof, LightNode, SendError } from "@waku/interfaces";
import { utf8ToBytes } from "@waku/utils/bytes";
import { expect } from "chai";

import { NimGoNode, TEST_STRING } from "../../src/index.js";
import { MessageRpcResponse } from "../../src/node/interfaces.js";
import { generateRandomUint8Array } from "../../src/random_array.js";

import {
  messagePayload,
  messageText,
  runNodes,
  tearDownNodes,
  TestContentTopic,
  TestEncoder,
  verifyReceivedMessage,
  waitForMessages
} from "./light_push_test_utils.js";

describe("Waku Light Push [node only]", function () {
  // Set the timeout for all tests in this suite. Can be overwritten at test level
  this.timeout(15000);
  let waku: LightNode;
  let nwaku: NimGoNode;

  this.beforeEach(async function () {
    this.timeout(15_000);
    [nwaku, waku] = await runNodes(this);
  });

  this.afterEach(async function () {
    tearDownNodes(nwaku, waku);
  });

  TEST_STRING.forEach((testItem) => {
    it(`Push message with payload containing ${testItem.description}`, async function () {
      const pushResponse = await waku.lightPush.send(TestEncoder, {
        payload: utf8ToBytes(testItem.value)
      });
      expect(pushResponse.recipients.length).to.eq(1);

      const msgs = await waitForMessages(nwaku, 1);

      verifyReceivedMessage(msgs[0], { expectedMessageText: testItem.value });
    });
  });

  it("Push multiple messages", async function () {
    const pushResponse = await waku.lightPush.send(TestEncoder, messagePayload);
    expect(pushResponse.recipients.length).to.eq(1);

    const msgs = await waitForMessages(nwaku, 1);

    verifyReceivedMessage(msgs[0], { expectedMessageText: messageText });
  });

  it("Push 30 different messages", async function () {
    const generateMessageText = (index: number): string => `M${index}`;

    for (let i = 0; i < 30; i++) {
      const pushResponse = await waku.lightPush.send(TestEncoder, {
        payload: utf8ToBytes(generateMessageText(i))
      });
      expect(pushResponse.recipients.length).to.eq(1);
    }

    const msgs = await waitForMessages(nwaku, 30);

    for (let i = 0; i < 30; i++) {
      verifyReceivedMessage(msgs[i], {
        expectedMessageText: generateMessageText(i)
      });
    }
  });

  it("Fails to push message with empty payload", async function () {
    const pushResponse = await waku.lightPush.send(TestEncoder, {
      payload: utf8ToBytes("")
    });

    expect(pushResponse.recipients.length).to.eq(0);
    expect(pushResponse.errors).to.include(SendError.NO_RPC_RESPONSE);
  });

  TEST_STRING.forEach((testItem) => {
    it(`Push message with content topic containing ${testItem.description}`, async function () {
      const customEncoder = createEncoder({
        contentTopic: testItem.value
      });
      const pushResponse = await waku.lightPush.send(
        customEncoder,
        messagePayload
      );
      expect(pushResponse.recipients.length).to.eq(1);

      const msgs = await waitForMessages(nwaku, 1);

      verifyReceivedMessage(msgs[0], {
        expectedMessageText: messageText,
        expectedContentTopic: testItem.value
      });
    });
  });

  it("Fails to push message with empty content topic", async function () {
    try {
      createEncoder({ contentTopic: "" });
      expect.fail("Expected an error but didn't get one");
    } catch (error) {
      expect((error as Error).message).to.equal(
        "Content topic must be specified"
      );
    }
  });

  it("Push message with meta", async function () {
    const customTestEncoder = createEncoder({
      contentTopic: TestContentTopic,
      metaSetter: () => new Uint8Array(10)
    });

    const pushResponse = await waku.lightPush.send(
      customTestEncoder,
      messagePayload
    );
    expect(pushResponse.recipients.length).to.eq(1);

    const msgs = await waitForMessages(nwaku, 1);

    verifyReceivedMessage(msgs[0], { expectedMessageText: messageText });
  });

  it("Fails to push message with large meta", async function () {
    const customTestEncoder = createEncoder({
      contentTopic: TestContentTopic,
      metaSetter: () => new Uint8Array(10 ** 6)
    });

    const pushResponse = await waku.lightPush.send(
      customTestEncoder,
      messagePayload
    );

    expect(pushResponse.recipients.length).to.eq(0);
    expect(pushResponse.errors).to.include(SendError.NO_RPC_RESPONSE);
  });

  it("Push message with rate limit", async function () {
    const rateLimitProof: IRateLimitProof = {
      proof: utf8ToBytes("proofData"),
      merkleRoot: utf8ToBytes("merkleRootData"),
      epoch: utf8ToBytes("epochData"),
      shareX: utf8ToBytes("shareXData"),
      shareY: utf8ToBytes("shareYData"),
      nullifier: utf8ToBytes("nullifierData"),
      rlnIdentifier: utf8ToBytes("rlnIdentifierData")
    };

    const pushResponse = await waku.lightPush.send(TestEncoder, {
      payload: utf8ToBytes(messageText),
      rateLimitProof: rateLimitProof
    });
    expect(pushResponse.recipients.length).to.eq(1);

    const msgs = await waitForMessages(nwaku, 1);

    verifyReceivedMessage(msgs[0], { expectedMessageText: messageText });
  });

  [
    Date.now() - 3600000 * 24 * 356,
    Date.now() - 3600000,
    Date.now() + 3600000
  ].forEach((testItem) => {
    it(`Push message with custom timestamp: ${testItem}`, async function () {
      const oneHourAgoNanos = BigInt(testItem) * BigInt(1000000);
      const pushResponse = await waku.lightPush.send(TestEncoder, {
        payload: utf8ToBytes(messageText),
        timestamp: new Date(testItem)
      });
      expect(pushResponse.recipients.length).to.eq(1);

      let msgs: MessageRpcResponse[] = [];

      msgs = await waitForMessages(nwaku, 1);

      verifyReceivedMessage(msgs[0], {
        expectedMessageText: messageText,
        expectedTimestamp: oneHourAgoNanos
      });
    });
  });

  it("Push message equal or less that 1MB", async function () {
    const MB = 1024 ** 2;

    let pushResponse = await waku.lightPush.send(TestEncoder, {
      payload: generateRandomUint8Array(MB)
    });
    expect(pushResponse.recipients.length).to.greaterThan(0);

    pushResponse = await waku.lightPush.send(TestEncoder, {
      payload: generateRandomUint8Array(65536)
    });
    expect(pushResponse.recipients.length).to.greaterThan(0);
  });

  it("Fails to push message bigger that 1MB", async function () {
    const MB = 1024 ** 2;

    const pushResponse = await waku.lightPush.send(TestEncoder, {
      payload: generateRandomUint8Array(MB + 65536)
    });
    expect(pushResponse.recipients.length).to.eq(0);
    expect(pushResponse.errors).to.include(SendError.SIZE_TOO_BIG);
  });
});

describe("Waku Light Push [node only] - custom pubsub topic", function () {
  this.timeout(15_000);
  let waku: LightNode;
  let nwaku: NimGoNode;
  const customPubSubTopic = "/waku/2/custom-dapp/proto";

  beforeEach(async function () {
    [nwaku, waku] = await runNodes(this, customPubSubTopic);
  });

  this.afterEach(async function () {
    tearDownNodes(nwaku, waku);
  });

  it("Push message", async function () {
    const nimPeerId = await nwaku.getPeerId();

    const pushResponse = await waku.lightPush.send(TestEncoder, {
      payload: utf8ToBytes(messageText)
    });

    expect(pushResponse.recipients[0].toString()).to.eq(nimPeerId.toString());

    const msgs = await waitForMessages(nwaku, 1, customPubSubTopic);

    verifyReceivedMessage(msgs[0], {
      expectedMessageText: messageText,
      expectedContentTopic: TestContentTopic
    });
  });
});

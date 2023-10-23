import { createEncoder, DefaultPubSubTopic } from "@waku/core";
import { IRateLimitProof, LightNode, SendError } from "@waku/interfaces";
import { utf8ToBytes } from "@waku/utils/bytes";
import { expect } from "chai";

import {
  MessageCollector,
  NimGoNode,
  tearDownNodes,
  TEST_STRING
} from "../../src/index.js";
import { generateRandomUint8Array } from "../../src/random_array.js";

import {
  messagePayload,
  messageText,
  runNodes,
  TestContentTopic,
  TestEncoder
} from "./utils.js";

describe("Waku Light Push", function () {
  // Set the timeout for all tests in this suite. Can be overwritten at test level
  this.timeout(15000);
  let waku: LightNode;
  let nwaku: NimGoNode;
  let messageCollector: MessageCollector;

  this.beforeEach(async function () {
    this.timeout(15000);
    [nwaku, waku] = await runNodes(this, [DefaultPubSubTopic]);
    messageCollector = new MessageCollector(nwaku);

    await nwaku.ensureSubscriptions();
  });

  this.afterEach(async function () {
    this.timeout(15000);
    await tearDownNodes(nwaku, waku);
  });

  TEST_STRING.forEach((testItem) => {
    it(`Push message with ${testItem.description} payload`, async function () {
      const pushResponse = await waku.lightPush.send(TestEncoder, {
        payload: utf8ToBytes(testItem.value)
      });
      expect(pushResponse.recipients.length).to.eq(1);

      expect(await messageCollector.waitForMessages(1)).to.eq(true);
      messageCollector.verifyReceivedMessage(0, {
        expectedMessageText: testItem.value,
        expectedContentTopic: TestContentTopic
      });
    });
  });

  it("Push 30 different messages", async function () {
    const generateMessageText = (index: number): string => `M${index}`;

    for (let i = 0; i < 30; i++) {
      const pushResponse = await waku.lightPush.send(TestEncoder, {
        payload: utf8ToBytes(generateMessageText(i))
      });
      expect(pushResponse.recipients.length).to.eq(1);
    }

    expect(await messageCollector.waitForMessages(30)).to.eq(true);

    for (let i = 0; i < 30; i++) {
      messageCollector.verifyReceivedMessage(i, {
        expectedMessageText: generateMessageText(i),
        expectedContentTopic: TestContentTopic
      });
    }
  });

  it("Throws when trying to push message with empty payload", async function () {
    const pushResponse = await waku.lightPush.send(TestEncoder, {
      payload: new Uint8Array()
    });

    expect(pushResponse.recipients.length).to.eq(0);
    expect(pushResponse.errors).to.include(SendError.EMPTY_PAYLOAD);
    expect(await messageCollector.waitForMessages(1)).to.eq(false);
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

      expect(await messageCollector.waitForMessages(1)).to.eq(true);
      messageCollector.verifyReceivedMessage(0, {
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

    expect(await messageCollector.waitForMessages(1)).to.eq(true);
    messageCollector.verifyReceivedMessage(0, {
      expectedMessageText: messageText,
      expectedContentTopic: TestContentTopic
    });
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

    if (nwaku.type() == "go-waku") {
      expect(pushResponse.recipients.length).to.eq(1);
      expect(await messageCollector.waitForMessages(1)).to.eq(true);
      messageCollector.verifyReceivedMessage(0, {
        expectedMessageText: messageText,
        expectedContentTopic: TestContentTopic
      });
    } else {
      expect(pushResponse.recipients.length).to.eq(0);
      expect(pushResponse.errors).to.include(SendError.REMOTE_PEER_REJECTED);
      expect(await messageCollector.waitForMessages(1)).to.eq(false);
    }
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

    expect(await messageCollector.waitForMessages(1)).to.eq(true);
    messageCollector.verifyReceivedMessage(0, {
      expectedMessageText: messageText,
      expectedContentTopic: TestContentTopic
    });
  });

  [
    Date.now() - 3600000 * 24 * 356,
    Date.now() - 3600000,
    Date.now() + 3600000
  ].forEach((testItem) => {
    it(`Push message with custom timestamp: ${testItem}`, async function () {
      const customTimeNanos = BigInt(testItem) * BigInt(1000000);
      const pushResponse = await waku.lightPush.send(TestEncoder, {
        payload: utf8ToBytes(messageText),
        timestamp: new Date(testItem)
      });
      expect(pushResponse.recipients.length).to.eq(1);

      expect(await messageCollector.waitForMessages(1)).to.eq(true);
      messageCollector.verifyReceivedMessage(0, {
        expectedMessageText: messageText,
        expectedTimestamp: customTimeNanos,
        expectedContentTopic: TestContentTopic
      });
    });
  });

  it("Push message equal or less that 1MB", async function () {
    const oneMbPayload = generateRandomUint8Array(1024 ** 2);
    let pushResponse = await waku.lightPush.send(TestEncoder, {
      payload: oneMbPayload
    });
    expect(pushResponse.recipients.length).to.greaterThan(0);

    const bigPayload = generateRandomUint8Array(65536);
    pushResponse = await waku.lightPush.send(TestEncoder, {
      payload: bigPayload
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
    expect(await messageCollector.waitForMessages(1)).to.eq(false);
  });
});

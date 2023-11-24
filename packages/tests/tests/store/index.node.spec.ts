import {
  createDecoder,
  DecodedMessage,
  DefaultPubsubTopic,
  waitForRemotePeer
} from "@waku/core";
import type { IMessage, LightNode } from "@waku/interfaces";
import { Protocols } from "@waku/interfaces";
import {
  generatePrivateKey,
  generateSymmetricKey,
  getPublicKey
} from "@waku/message-encryption";
import {
  createDecoder as createEciesDecoder,
  createEncoder as createEciesEncoder
} from "@waku/message-encryption/ecies";
import {
  createDecoder as createSymDecoder,
  createEncoder as createSymEncoder
} from "@waku/message-encryption/symmetric";
import { bytesToUtf8, utf8ToBytes } from "@waku/utils/bytes";
import { expect } from "chai";
import { equals } from "uint8arrays/equals";

import {
  delay,
  makeLogFileName,
  MessageCollector,
  NimGoNode,
  tearDownNodes,
  TEST_STRING
} from "../../src/index.js";

import {
  customContentTopic,
  log,
  messageText,
  processQueriedMessages,
  sendMessages,
  startAndConnectLightNode,
  TestContentTopic,
  TestDecoder,
  TestEncoder,
  totalMsgs
} from "./utils.js";

const secondDecoder = createDecoder(customContentTopic, DefaultPubsubTopic);

describe("Waku Store, general", function () {
  this.timeout(15000);
  let waku: LightNode;
  let waku2: LightNode;
  let nwaku: NimGoNode;

  beforeEach(async function () {
    this.timeout(15000);
    nwaku = new NimGoNode(makeLogFileName(this));
    await nwaku.start({ store: true, lightpush: true, relay: true });
    await nwaku.ensureSubscriptions();
  });

  afterEach(async function () {
    this.timeout(15000);
    await tearDownNodes(nwaku, [waku, waku2]);
  });

  it("Query generator for multiple messages", async function () {
    await sendMessages(nwaku, totalMsgs, TestContentTopic, DefaultPubsubTopic);
    waku = await startAndConnectLightNode(nwaku);
    const messages = await processQueriedMessages(
      waku,
      [TestDecoder],
      DefaultPubsubTopic
    );

    expect(messages?.length).eq(totalMsgs);

    // checking that the message with text 0 exists
    const result = messages?.findIndex((msg) => {
      return msg.payload[0]! === 0;
    });
    expect(result).to.not.eq(-1);
  });

  it("Query generator for multiple messages with different message text format", async function () {
    for (const testItem of TEST_STRING) {
      expect(
        await nwaku.sendMessage(
          NimGoNode.toMessageRpcQuery({
            payload: utf8ToBytes(testItem["value"]),
            contentTopic: TestContentTopic
          }),
          DefaultPubsubTopic
        )
      ).to.eq(true);
      await delay(1); // to ensure each timestamp is unique.
    }

    waku = await startAndConnectLightNode(nwaku);
    const messageCollector = new MessageCollector();
    messageCollector.list = await processQueriedMessages(
      waku,
      [TestDecoder],
      DefaultPubsubTopic
    );

    // checking that all message sent were retrieved
    TEST_STRING.forEach((testItem) => {
      expect(
        messageCollector.hasMessage(TestContentTopic, testItem["value"])
      ).to.eq(true);
    });
  });

  it("Query generator for multiple messages with multiple decoders", async function () {
    await nwaku.sendMessage(
      NimGoNode.toMessageRpcQuery({
        payload: utf8ToBytes("M1"),
        contentTopic: TestContentTopic
      }),
      DefaultPubsubTopic
    );
    await nwaku.sendMessage(
      NimGoNode.toMessageRpcQuery({
        payload: utf8ToBytes("M2"),
        contentTopic: customContentTopic
      }),
      DefaultPubsubTopic
    );
    waku = await startAndConnectLightNode(nwaku);

    const messageCollector = new MessageCollector();
    messageCollector.list = await processQueriedMessages(
      waku,
      [TestDecoder, secondDecoder],
      DefaultPubsubTopic
    );
    expect(messageCollector.hasMessage(TestContentTopic, "M1")).to.eq(true);
    expect(messageCollector.hasMessage(customContentTopic, "M2")).to.eq(true);
  });

  it("Query generator for multiple messages with different content topic format", async function () {
    for (const testItem of TEST_STRING) {
      expect(
        await nwaku.sendMessage(
          NimGoNode.toMessageRpcQuery({
            payload: utf8ToBytes(messageText),
            contentTopic: testItem["value"]
          }),
          DefaultPubsubTopic
        )
      ).to.eq(true);
      await delay(1); // to ensure each timestamp is unique.
    }

    waku = await startAndConnectLightNode(nwaku);

    for (const testItem of TEST_STRING) {
      for await (const query of waku.store.queryGenerator([
        createDecoder(testItem["value"])
      ])) {
        for await (const msg of query) {
          expect(equals(msg!.payload, utf8ToBytes(messageText))).to.eq(true);
        }
      }
    }
  });

  it("Callback on promise", async function () {
    await sendMessages(nwaku, totalMsgs, TestContentTopic, DefaultPubsubTopic);
    waku = await startAndConnectLightNode(nwaku);

    const messages: IMessage[] = [];
    await waku.store.queryWithPromiseCallback(
      [TestDecoder],
      async (msgPromise) => {
        const msg = await msgPromise;
        if (msg) {
          messages.push(msg);
        }
      }
    );

    expect(messages?.length).eq(totalMsgs);
    const result = messages?.findIndex((msg) => {
      return msg.payload[0]! === 0;
    });
    expect(result).to.not.eq(-1);
  });

  it("Callback on promise, aborts when callback returns true", async function () {
    await sendMessages(nwaku, totalMsgs, TestContentTopic, DefaultPubsubTopic);
    waku = await startAndConnectLightNode(nwaku);

    const desiredMsgs = 14;
    const messages: IMessage[] = [];
    await waku.store.queryWithPromiseCallback(
      [TestDecoder],
      async (msgPromise) => {
        const msg = await msgPromise;
        if (msg) {
          messages.push(msg);
        }
        return messages.length >= desiredMsgs;
      },
      { pageSize: 7 }
    );

    expect(messages?.length).eq(desiredMsgs);
  });

  it("Generator, with asymmetric & symmetric encrypted messages", async function () {
    const asymText = "This message is encrypted for me using asymmetric";
    const asymTopic = "/test/1/asymmetric/proto";
    const symText =
      "This message is encrypted for me using symmetric encryption";
    const symTopic = "/test/1/symmetric/proto";
    const clearText = "This is a clear text message for everyone to read";
    const otherText =
      "This message is not for and I must not be able to read it";

    const timestamp = new Date();

    const asymMsg = { payload: utf8ToBytes(asymText), timestamp };
    const symMsg = {
      payload: utf8ToBytes(symText),
      timestamp: new Date(timestamp.valueOf() + 1)
    };
    const clearMsg = {
      payload: utf8ToBytes(clearText),
      timestamp: new Date(timestamp.valueOf() + 2)
    };
    const otherMsg = {
      payload: utf8ToBytes(otherText),
      timestamp: new Date(timestamp.valueOf() + 3)
    };

    const privateKey = generatePrivateKey();
    const symKey = generateSymmetricKey();
    const publicKey = getPublicKey(privateKey);

    const eciesEncoder = createEciesEncoder({
      contentTopic: asymTopic,
      publicKey
    });
    const symEncoder = createSymEncoder({
      contentTopic: symTopic,
      symKey
    });

    const otherEncoder = createEciesEncoder({
      contentTopic: TestContentTopic,
      publicKey: getPublicKey(generatePrivateKey())
    });

    const eciesDecoder = createEciesDecoder(asymTopic, privateKey);
    const symDecoder = createSymDecoder(symTopic, symKey);

    waku = await startAndConnectLightNode(nwaku);
    waku2 = await startAndConnectLightNode(nwaku);
    const nimWakuMultiaddr = await nwaku.getMultiaddrWithId();

    await Promise.all([
      waku.dial(nimWakuMultiaddr),
      waku2.dial(nimWakuMultiaddr)
    ]);

    log.info("Waku nodes connected to nwaku");

    await waitForRemotePeer(waku, [Protocols.LightPush]);

    log.info("Sending messages using light push");
    await Promise.all([
      waku.lightPush.send(eciesEncoder, asymMsg),
      waku.lightPush.send(symEncoder, symMsg),
      waku.lightPush.send(otherEncoder, otherMsg),
      waku.lightPush.send(TestEncoder, clearMsg)
    ]);

    await waitForRemotePeer(waku2, [Protocols.Store]);

    const messages: DecodedMessage[] = [];
    log.info("Retrieve messages from store");

    for await (const query of waku2.store.queryGenerator([
      eciesDecoder,
      symDecoder,
      TestDecoder
    ])) {
      for await (const msg of query) {
        if (msg) {
          messages.push(msg as DecodedMessage);
        }
      }
    }

    // Messages are ordered from oldest to latest within a page (1 page query)
    expect(bytesToUtf8(messages[0].payload!)).to.eq(asymText);
    expect(bytesToUtf8(messages[1].payload!)).to.eq(symText);
    expect(bytesToUtf8(messages[2].payload!)).to.eq(clearText);
    expect(messages?.length).eq(3);
  });

  it("Ordered callback, aborts when callback returns true", async function () {
    await sendMessages(nwaku, totalMsgs, TestContentTopic, DefaultPubsubTopic);
    waku = await startAndConnectLightNode(nwaku);

    const desiredMsgs = 14;
    const messages: IMessage[] = [];
    await waku.store.queryWithOrderedCallback(
      [TestDecoder],
      async (msg) => {
        messages.push(msg);
        return messages.length >= desiredMsgs;
      },
      { pageSize: 7 }
    );

    expect(messages?.length).eq(desiredMsgs);
  });

  it("Query generator for 2000 messages", async function () {
    this.timeout(40000);
    await sendMessages(nwaku, 2000, TestContentTopic, DefaultPubsubTopic);
    waku = await startAndConnectLightNode(nwaku);
    const messages = await processQueriedMessages(
      waku,
      [TestDecoder],
      DefaultPubsubTopic
    );

    expect(messages?.length).eq(2000);
  });
});

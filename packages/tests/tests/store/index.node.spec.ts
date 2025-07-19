import { createDecoder, DecodedMessage } from "@waku/core";
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
import { createRoutingInfo } from "@waku/utils";
import { bytesToUtf8, utf8ToBytes } from "@waku/utils/bytes";
import { expect } from "chai";
import { equals } from "uint8arrays/equals";

import {
  afterEachCustom,
  beforeEachCustom,
  delay,
  MessageCollector,
  ServiceNode,
  tearDownNodes,
  TEST_STRING
} from "../../src/index.js";

import {
  log,
  messageText,
  processQueriedMessages,
  runStoreNodes,
  sendMessages,
  startAndConnectLightNode,
  TestContentTopic,
  TestDecoder,
  TestEncoder,
  TestNetworkConfig,
  TestRoutingInfo,
  totalMsgs
} from "./utils.js";

describe("Waku Store, general", function () {
  this.timeout(15000);
  let waku: LightNode;
  let waku2: LightNode;
  let nwaku: ServiceNode;

  beforeEachCustom(this, async () => {
    [nwaku, waku] = await runStoreNodes(this.ctx, TestNetworkConfig);
  });

  afterEachCustom(this, async () => {
    await tearDownNodes(nwaku, [waku, waku2]);
  });

  it("Query generator for multiple messages", async function () {
    await sendMessages(
      nwaku,
      totalMsgs,
      TestDecoder.contentTopic,
      TestRoutingInfo
    );

    const messages = await processQueriedMessages(
      waku,
      [TestDecoder],
      TestRoutingInfo.pubsubTopic
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
          ServiceNode.toMessageRpcQuery({
            payload: utf8ToBytes(testItem["value"]),
            contentTopic: TestDecoder.contentTopic
          }),
          TestRoutingInfo
        )
      ).to.eq(true);
      await delay(1); // to ensure each timestamp is unique.
    }

    const messageCollector = new MessageCollector(nwaku);
    messageCollector.list = await processQueriedMessages(
      waku,
      [TestDecoder],
      TestRoutingInfo.pubsubTopic
    );

    // checking that all message sent were retrieved
    TEST_STRING.forEach((testItem) => {
      expect(
        messageCollector.hasMessage(TestDecoder.contentTopic, testItem["value"])
      ).to.eq(true);
    });
  });

  it("Query generator for multiple messages with multiple decoders", async function () {
    const secondContentTopic = "/test/1/waku-store-two/utf8";
    const secondRoutingInfo = createRoutingInfo(TestNetworkConfig, {
      contentTopic: secondContentTopic
    });
    const secondDecoder = createDecoder(secondContentTopic, secondRoutingInfo);

    await nwaku.sendMessage(
      ServiceNode.toMessageRpcQuery({
        payload: utf8ToBytes("M1"),
        contentTopic: TestContentTopic
      }),
      TestRoutingInfo
    );
    await nwaku.sendMessage(
      ServiceNode.toMessageRpcQuery({
        payload: utf8ToBytes("M2"),
        contentTopic: secondContentTopic
      }),
      secondRoutingInfo
    );

    const messageCollector = new MessageCollector(nwaku);
    messageCollector.list = await processQueriedMessages(
      waku,
      [TestDecoder, secondDecoder],
      TestRoutingInfo.pubsubTopic
    );
    expect(messageCollector.hasMessage(TestDecoder.contentTopic, "M1")).to.eq(
      true
    );
    expect(messageCollector.hasMessage(secondContentTopic, "M2")).to.eq(true);
  });

  it("Query generator for multiple messages with different content topic format", async function () {
    for (const testItem of TEST_STRING) {
      if (testItem.invalidContentTopic) continue;

      const contentTopic = `/test/1/${testItem.value}/proto`;
      const routingInfo = createRoutingInfo(TestNetworkConfig, {
        contentTopic
      });
      expect(
        await nwaku.sendMessage(
          ServiceNode.toMessageRpcQuery({
            payload: utf8ToBytes(messageText),
            contentTopic
          }),
          routingInfo
        )
      ).to.eq(true);
      await delay(1); // to ensure each timestamp is unique.
    }

    for (const testItem of TEST_STRING) {
      if (testItem.invalidContentTopic) continue;

      const contentTopic = `/test/1/${testItem.value}/proto`;
      const routingInfo = createRoutingInfo(TestNetworkConfig, {
        contentTopic
      });

      for await (const query of waku.store.queryGenerator([
        createDecoder(contentTopic, routingInfo)
      ])) {
        for await (const msg of query) {
          expect(equals(msg!.payload, utf8ToBytes(messageText))).to.eq(true);
        }
      }
    }
  });

  it("Callback on promise", async function () {
    await sendMessages(
      nwaku,
      totalMsgs,
      TestDecoder.contentTopic,
      TestRoutingInfo
    );

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
    await sendMessages(
      nwaku,
      totalMsgs,
      TestDecoder.contentTopic,
      TestRoutingInfo
    );

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
      { paginationLimit: 7 }
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
      publicKey,
      routingInfo: TestRoutingInfo
    });
    const symEncoder = createSymEncoder({
      contentTopic: symTopic,
      symKey,
      routingInfo: TestRoutingInfo
    });

    const otherEncoder = createEciesEncoder({
      contentTopic: TestContentTopic,
      routingInfo: TestRoutingInfo,
      publicKey: getPublicKey(generatePrivateKey())
    });

    const eciesDecoder = createEciesDecoder(
      asymTopic,
      TestRoutingInfo,
      privateKey
    );
    const symDecoder = createSymDecoder(symTopic, TestRoutingInfo, symKey);

    waku2 = await startAndConnectLightNode(nwaku, TestNetworkConfig);
    const nimWakuMultiaddr = await nwaku.getMultiaddrWithId();
    await waku2.dial(nimWakuMultiaddr);

    log.info("Sending messages using light push");
    await Promise.all([
      waku.lightPush.send(eciesEncoder, asymMsg),
      waku.lightPush.send(symEncoder, symMsg),
      waku.lightPush.send(otherEncoder, otherMsg),
      waku.lightPush.send(TestEncoder, clearMsg)
    ]);

    await waku2.waitForPeers([Protocols.Store]);

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
    await sendMessages(
      nwaku,
      totalMsgs,
      TestDecoder.contentTopic,
      TestRoutingInfo
    );

    const desiredMsgs = 14;
    const messages: IMessage[] = [];
    await waku.store.queryWithOrderedCallback(
      [TestDecoder],
      async (msg) => {
        messages.push(msg);
        return messages.length >= desiredMsgs;
      },
      { paginationLimit: 7 }
    );

    expect(messages?.length).eq(desiredMsgs);
  });

  it("Query generator for 2000 messages", async function () {
    this.timeout(40000);
    await sendMessages(nwaku, 2000, TestDecoder.contentTopic, TestRoutingInfo);

    const messages = await processQueriedMessages(
      waku,
      [TestDecoder],
      TestRoutingInfo.pubsubTopic
    );

    expect(messages?.length).eq(2000);
  });
});

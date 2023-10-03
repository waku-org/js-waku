import {
  createCursor,
  createDecoder,
  DecodedMessage,
  DefaultPubSubTopic,
  PageDirection,
  waitForRemotePeer
} from "@waku/core";
import type { IMessage, LightNode } from "@waku/interfaces";
import { Protocols } from "@waku/interfaces";
import {
  createDecoder as createEciesDecoder,
  createEncoder as createEciesEncoder,
  generatePrivateKey,
  getPublicKey
} from "@waku/message-encryption/ecies";
import {
  createDecoder as createSymDecoder,
  createEncoder as createSymEncoder,
  generateSymmetricKey
} from "@waku/message-encryption/symmetric";
import { bytesToUtf8, utf8ToBytes } from "@waku/utils/bytes";
import { expect } from "chai";

import {
  delay,
  makeLogFileName,
  MessageCollector,
  NimGoNode,
  tearDownNodes,
  TEST_STRING
} from "../../src/index.js";
import { areUint8ArraysEqual } from "../../src/utils.js";

import {
  customContentTopic,
  log,
  messageText,
  processMessages,
  sendMessages,
  startAndConnectLightNode,
  TestContentTopic,
  TestDecoder,
  TestEncoder,
  totalMsgs
} from "./utils.js";

describe("Waku Store", function () {
  this.timeout(15000);
  let waku: LightNode;
  let waku2: LightNode;
  let nwaku: NimGoNode;

  beforeEach(async function () {
    this.timeout(15000);
    nwaku = new NimGoNode(makeLogFileName(this));
    await nwaku.startWithRetries({ store: true, lightpush: true, relay: true });
  });

  afterEach(async function () {
    this.timeout(15000);
    await tearDownNodes([nwaku], [waku, waku2]);
  });

  it("Query generator for multiple messages", async function () {
    await sendMessages(nwaku, totalMsgs, TestContentTopic, DefaultPubSubTopic);
    waku = await startAndConnectLightNode(nwaku);
    const messages = await processMessages(
      waku,
      [TestDecoder],
      DefaultPubSubTopic
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
          DefaultPubSubTopic
        )
      ).to.be.true;
      await delay(1); // to ensure each timestamp is unique.
    }

    waku = await startAndConnectLightNode(nwaku);
    const messageCollector = new MessageCollector();
    messageCollector.list = await processMessages(
      waku,
      [TestDecoder],
      DefaultPubSubTopic
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
      DefaultPubSubTopic
    );
    await nwaku.sendMessage(
      NimGoNode.toMessageRpcQuery({
        payload: utf8ToBytes("M2"),
        contentTopic: customContentTopic
      }),
      DefaultPubSubTopic
    );
    waku = await startAndConnectLightNode(nwaku);

    const secondDecoder = createDecoder(customContentTopic, DefaultPubSubTopic);

    const messageCollector = new MessageCollector();
    messageCollector.list = await processMessages(
      waku,
      [TestDecoder, secondDecoder],
      DefaultPubSubTopic
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
          DefaultPubSubTopic
        )
      ).to.be.true;
      await delay(1); // to ensure each timestamp is unique.
    }

    waku = await startAndConnectLightNode(nwaku);

    let localPromises: Promise<void>[] = [];
    for (const testItem of TEST_STRING) {
      for await (const msgPromises of waku.store.queryGenerator([
        createDecoder(testItem["value"])
      ])) {
        const _promises = msgPromises.map(async (promise) => {
          const msg = await promise;
          if (msg) {
            expect(
              areUint8ArraysEqual(msg.payload, utf8ToBytes(messageText))
            ).to.eq(true);
          }
        });

        localPromises = localPromises.concat(_promises);
      }
      await Promise.all(localPromises);
    }
  });

  it("Query generator, no message returned", async function () {
    waku = await startAndConnectLightNode(nwaku);
    const messages = await processMessages(
      waku,
      [TestDecoder],
      DefaultPubSubTopic
    );

    expect(messages?.length).eq(0);
  });

  it("Passing a cursor", async function () {
    await sendMessages(nwaku, totalMsgs, TestContentTopic, DefaultPubSubTopic);
    waku = await startAndConnectLightNode(nwaku);

    const query = waku.store.queryGenerator([TestDecoder]);

    // messages in reversed order (first message at last index)
    const messages: DecodedMessage[] = [];
    for await (const page of query) {
      for await (const msg of page.reverse()) {
        messages.push(msg as DecodedMessage);
      }
    }

    // index 2 would mean the third last message sent
    const cursorIndex = 2;

    // create cursor to extract messages after the 3rd index
    const cursor = await createCursor(messages[cursorIndex]);

    const messagesAfterCursor: DecodedMessage[] = [];
    for await (const page of waku.store.queryGenerator([TestDecoder], {
      cursor
    })) {
      for await (const msg of page.reverse()) {
        messagesAfterCursor.push(msg as DecodedMessage);
      }
    }

    const testMessage = messagesAfterCursor[0];

    expect(messages.length).be.eq(totalMsgs);

    expect(bytesToUtf8(testMessage.payload)).to.be.eq(
      bytesToUtf8(messages[cursorIndex + 1].payload)
    );
  });

  it("Callback on promise", async function () {
    await sendMessages(nwaku, totalMsgs, TestContentTopic, DefaultPubSubTopic);
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
    await sendMessages(nwaku, totalMsgs, TestContentTopic, DefaultPubSubTopic);
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

  it("Ordered Callback - Forward", async function () {
    await sendMessages(nwaku, totalMsgs, TestContentTopic, DefaultPubSubTopic);
    waku = await startAndConnectLightNode(nwaku);

    const messages: IMessage[] = [];
    await waku.store.queryWithOrderedCallback(
      [TestDecoder],
      async (msg) => {
        messages.push(msg);
      },
      {
        pageDirection: PageDirection.FORWARD
      }
    );

    expect(messages?.length).eq(totalMsgs);
    const payloads = messages.map((msg) => msg.payload[0]!);
    expect(payloads).to.deep.eq(Array.from(Array(totalMsgs).keys()));
  });

  it("Ordered Callback - Backward", async function () {
    await sendMessages(nwaku, totalMsgs, TestContentTopic, DefaultPubSubTopic);
    waku = await startAndConnectLightNode(nwaku);

    let messages: IMessage[] = [];
    await waku.store.queryWithOrderedCallback(
      [TestDecoder],
      async (msg) => {
        messages.push(msg);
      },
      {
        pageDirection: PageDirection.BACKWARD
      }
    );

    messages = messages.reverse();

    expect(messages?.length).eq(totalMsgs);
    const payloads = messages.map((msg) => msg.payload![0]!);
    expect(payloads).to.deep.eq(Array.from(Array(totalMsgs).keys()));
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

    log("Waku nodes connected to nwaku");

    await waitForRemotePeer(waku, [Protocols.LightPush]);

    log("Sending messages using light push");
    await Promise.all([
      waku.lightPush.send(eciesEncoder, asymMsg),
      waku.lightPush.send(symEncoder, symMsg),
      waku.lightPush.send(otherEncoder, otherMsg),
      waku.lightPush.send(TestEncoder, clearMsg)
    ]);

    await waitForRemotePeer(waku2, [Protocols.Store]);

    const messages: DecodedMessage[] = [];
    log("Retrieve messages from store");

    for await (const msgPromises of waku2.store.queryGenerator([
      eciesDecoder,
      symDecoder,
      TestDecoder
    ])) {
      for (const promise of msgPromises) {
        const msg = await promise;
        if (msg) {
          messages.push(msg);
        }
      }
    }

    // Messages are ordered from oldest to latest within a page (1 page query)
    expect(bytesToUtf8(messages[0].payload!)).to.eq(asymText);
    expect(bytesToUtf8(messages[1].payload!)).to.eq(symText);
    expect(bytesToUtf8(messages[2].payload!)).to.eq(clearText);
    expect(messages?.length).eq(3);
  });

  it("Ordered callback, using start and end time", async function () {
    const now = new Date();

    const startTime = new Date();
    // Set start time 15 seconds in the past
    startTime.setTime(now.getTime() - 15 * 1000);

    const message1Timestamp = new Date();
    // Set first message was 10 seconds in the past
    message1Timestamp.setTime(now.getTime() - 10 * 1000);

    const message2Timestamp = new Date();
    // Set second message 2 seconds in the past
    message2Timestamp.setTime(now.getTime() - 2 * 1000);
    const messageTimestamps = [message1Timestamp, message2Timestamp];

    const endTime = new Date();
    // Set end time 1 second in the past
    endTime.setTime(now.getTime() - 1000);

    await sendMessages(nwaku, 2, TestContentTopic, DefaultPubSubTopic);
    waku = await startAndConnectLightNode(nwaku);

    for (let i = 0; i < 2; i++) {
      expect(
        await nwaku.sendMessage(
          NimGoNode.toMessageRpcQuery({
            payload: new Uint8Array([i]),
            contentTopic: TestContentTopic,
            timestamp: messageTimestamps[i]
          })
        )
      ).to.be.true;
    }

    waku = await startAndConnectLightNode(nwaku);

    const firstMessages: IMessage[] = [];
    await waku.store.queryWithOrderedCallback(
      [TestDecoder],
      (msg) => {
        if (msg) {
          firstMessages.push(msg);
        }
      },
      {
        timeFilter: { startTime, endTime: message1Timestamp }
      }
    );

    const bothMessages: IMessage[] = [];
    await waku.store.queryWithOrderedCallback(
      [TestDecoder],
      async (msg) => {
        bothMessages.push(msg);
      },
      {
        timeFilter: {
          startTime,
          endTime
        }
      }
    );

    expect(firstMessages?.length).eq(1);

    expect(firstMessages[0].payload![0]!).eq(0);

    expect(bothMessages?.length).eq(2);
  });

  it("Ordered callback, aborts when callback returns true", async function () {
    await sendMessages(nwaku, totalMsgs, TestContentTopic, DefaultPubSubTopic);
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
});

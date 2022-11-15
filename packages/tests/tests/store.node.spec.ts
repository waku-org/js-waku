import { bytesToUtf8, utf8ToBytes } from "@waku/byte-utils";
import { createCursor, PageDirection } from "@waku/core";
import { waitForRemotePeer } from "@waku/core/lib/wait_for_remote_peer";
import { DecoderV0, EncoderV0 } from "@waku/core/lib/waku_message/version_0";
import { createFullNode } from "@waku/create";
import type { Message, WakuFull } from "@waku/interfaces";
import { Protocols } from "@waku/interfaces";
import {
  AsymDecoder,
  AsymEncoder,
  generatePrivateKey,
  generateSymmetricKey,
  getPublicKey,
  SymDecoder,
  SymEncoder,
} from "@waku/message-encryption";
import { expect } from "chai";
import debug from "debug";

import { makeLogFileName, NOISE_KEY_1, NOISE_KEY_2, Nwaku } from "../src";

const log = debug("waku:test:store");

const TestContentTopic = "/test/1/waku-store/utf8";
const TestEncoder = new EncoderV0(TestContentTopic);
const TestDecoder = new DecoderV0(TestContentTopic);

describe("Waku Store", () => {
  let waku: WakuFull;
  let nwaku: Nwaku;

  beforeEach(async function () {
    this.timeout(15_000);
    nwaku = new Nwaku(makeLogFileName(this));
    await nwaku.start({ persistMessages: true, store: true, lightpush: true });
  });

  afterEach(async function () {
    !!nwaku && nwaku.stop();
    !!waku && waku.stop().catch((e) => console.log("Waku failed to stop", e));
  });

  it("Generator", async function () {
    this.timeout(1000_000);
    const totalMsgs = 20;

    for (let i = 0; i < totalMsgs; i++) {
      expect(
        await nwaku.sendMessage(
          Nwaku.toMessageRpcQuery({
            payload: utf8ToBytes(`Message ${i}`),
            contentTopic: TestContentTopic,
          })
        )
      ).to.be.true;
    }

    waku = await createFullNode({
      staticNoiseKey: NOISE_KEY_1,
    });
    await waku.start();
    await waku.dial(await nwaku.getMultiaddrWithId());
    await waitForRemotePeer(waku, [Protocols.Store]);

    const messages: Message[] = [];
    let promises: Promise<void>[] = [];
    for await (const msgPromises of waku.store.queryGenerator([TestDecoder])) {
      const _promises = msgPromises.map(async (promise) => {
        const msg = await promise;
        if (msg) {
          messages.push(msg);
        }
      });

      promises = promises.concat(_promises);
    }
    await Promise.all(promises);

    expect(messages?.length).eq(totalMsgs);
    const result = messages?.findIndex((msg) => {
      return bytesToUtf8(msg.payload!) === "Message 0";
    });
    expect(result).to.not.eq(-1);
  });

  it("Generator, no message returned", async function () {
    this.timeout(15_000);

    waku = await createFullNode({
      staticNoiseKey: NOISE_KEY_1,
    });
    await waku.start();
    await waku.dial(await nwaku.getMultiaddrWithId());
    await waitForRemotePeer(waku, [Protocols.Store]);

    const messages: Message[] = [];
    let promises: Promise<void>[] = [];
    for await (const msgPromises of waku.store.queryGenerator([TestDecoder])) {
      const _promises = msgPromises.map(async (promise) => {
        const msg = await promise;
        if (msg) {
          messages.push(msg);
        }
      });

      promises = promises.concat(_promises);
    }
    await Promise.all(promises);

    expect(messages?.length).eq(0);
  });

  it("Passing a cursor", async function () {
    this.timeout(4_000);
    const totalMsgs = 20;

    for (let i = 0; i < totalMsgs; i++) {
      expect(
        await nwaku.sendMessage(
          Nwaku.toMessageRpcQuery({
            payload: utf8ToBytes(`Message ${i}`),
            contentTopic: TestContentTopic,
          })
        )
      ).to.be.true;
    }

    waku = await createFullNode({
      staticNoiseKey: NOISE_KEY_1,
    });
    await waku.start();
    await waku.dial(await nwaku.getMultiaddrWithId());
    await waitForRemotePeer(waku, [Protocols.Store]);

    const query = waku.store.queryGenerator([TestDecoder]);

    // messages in reversed order (first message at last index)
    const messages: Message[] = [];
    for await (const page of query) {
      for await (const msg of page.reverse()) {
        messages.push(msg as Message);
      }
    }

    // index 2 would mean the third last message sent
    const cursorIndex = 2;
    const cursorMessage = messages[cursorIndex];

    // create cursor to extract messages after the 3rd index
    const cursor = await createCursor(
      bytesToUtf8(cursorMessage.payload!),
      BigInt(cursorMessage.timestamp!.getTime()) * BigInt(1000000),
      TestContentTopic
    );

    const messagesAfterCursor: Message[] = [];
    for await (const page of waku.store.queryGenerator([TestDecoder], {
      cursor,
    })) {
      for await (const msg of page.reverse()) {
        messagesAfterCursor.push(msg as Message);
      }
    }

    const testMessage = messagesAfterCursor[0];

    expect(messages.length).be.eq(totalMsgs);

    expect(bytesToUtf8(testMessage.payload!)).to.be.eq(
      bytesToUtf8(messages[cursorIndex + 1].payload!)
    );
  });

  it("Callback on promise", async function () {
    this.timeout(15_000);

    const totalMsgs = 15;

    for (let i = 0; i < totalMsgs; i++) {
      expect(
        await nwaku.sendMessage(
          Nwaku.toMessageRpcQuery({
            payload: utf8ToBytes(`Message ${i}`),
            contentTopic: TestContentTopic,
          })
        )
      ).to.be.true;
    }

    waku = await createFullNode({
      staticNoiseKey: NOISE_KEY_1,
    });
    await waku.start();
    await waku.dial(await nwaku.getMultiaddrWithId());
    await waitForRemotePeer(waku, [Protocols.Store]);

    const messages: Message[] = [];
    await waku.store.queryCallbackOnPromise(
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
      return bytesToUtf8(msg.payload!) === "Message 0";
    });
    expect(result).to.not.eq(-1);
  });

  it("Callback on promise, aborts when callback returns true", async function () {
    this.timeout(15_000);

    const totalMsgs = 20;

    for (let i = 0; i < totalMsgs; i++) {
      expect(
        await nwaku.sendMessage(
          Nwaku.toMessageRpcQuery({
            payload: utf8ToBytes(`Message ${i}`),
            contentTopic: TestContentTopic,
          })
        )
      ).to.be.true;
    }

    waku = await createFullNode({
      staticNoiseKey: NOISE_KEY_1,
    });
    await waku.start();
    await waku.dial(await nwaku.getMultiaddrWithId());
    await waitForRemotePeer(waku, [Protocols.Store]);

    const desiredMsgs = 14;
    const messages: Message[] = [];
    await waku.store.queryCallbackOnPromise(
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
    this.timeout(15_000);

    const totalMsgs = 18;
    for (let i = 0; i < totalMsgs; i++) {
      expect(
        await nwaku.sendMessage(
          Nwaku.toMessageRpcQuery({
            payload: utf8ToBytes(`Message ${i}`),
            contentTopic: TestContentTopic,
          })
        )
      ).to.be.true;
    }

    waku = await createFullNode({
      staticNoiseKey: NOISE_KEY_1,
    });
    await waku.start();
    await waku.dial(await nwaku.getMultiaddrWithId());
    await waitForRemotePeer(waku, [Protocols.Store]);

    const messages: Message[] = [];
    await waku.store.queryOrderedCallback(
      [TestDecoder],
      async (msg) => {
        messages.push(msg);
      },
      {
        pageDirection: PageDirection.FORWARD,
      }
    );

    expect(messages?.length).eq(totalMsgs);
    for (let index = 0; index < totalMsgs; index++) {
      expect(
        messages?.findIndex((msg) => {
          return bytesToUtf8(msg.payload!) === `Message ${index}`;
        })
      ).to.eq(index);
    }
  });

  it("Ordered Callback - Backward", async function () {
    this.timeout(15_000);

    const totalMsgs = 18;
    for (let i = 0; i < totalMsgs; i++) {
      expect(
        await nwaku.sendMessage(
          Nwaku.toMessageRpcQuery({
            payload: utf8ToBytes(`Message ${i}`),
            contentTopic: TestContentTopic,
          })
        )
      ).to.be.true;
    }

    waku = await createFullNode({
      staticNoiseKey: NOISE_KEY_1,
    });
    await waku.start();
    await waku.dial(await nwaku.getMultiaddrWithId());
    await waitForRemotePeer(waku, [Protocols.Store]);

    let messages: Message[] = [];
    await waku.store.queryOrderedCallback(
      [TestDecoder],
      async (msg) => {
        messages.push(msg);
      },
      {
        pageDirection: PageDirection.BACKWARD,
      }
    );

    messages = messages.reverse();

    expect(messages?.length).eq(totalMsgs);
    for (let index = 0; index < totalMsgs; index++) {
      expect(
        messages?.findIndex((msg) => {
          return bytesToUtf8(msg.payload!) === `Message ${index}`;
        })
      ).to.eq(index);
    }
  });

  it("Generator, with asymmetric & symmetric encrypted messages", async function () {
    this.timeout(15_000);

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
      timestamp: new Date(timestamp.valueOf() + 1),
    };
    const clearMsg = {
      payload: utf8ToBytes(clearText),
      timestamp: new Date(timestamp.valueOf() + 2),
    };
    const otherMsg = {
      payload: utf8ToBytes(otherText),
      timestamp: new Date(timestamp.valueOf() + 3),
    };

    const privateKey = generatePrivateKey();
    const symKey = generateSymmetricKey();
    const publicKey = getPublicKey(privateKey);

    const asymEncoder = new AsymEncoder(asymTopic, publicKey);
    const symEncoder = new SymEncoder(symTopic, symKey);

    const otherEncoder = new AsymEncoder(
      TestContentTopic,
      getPublicKey(generatePrivateKey())
    );

    const asymDecoder = new AsymDecoder(asymTopic, privateKey);
    const symDecoder = new SymDecoder(symTopic, symKey);

    const [waku1, waku2, nimWakuMultiaddr] = await Promise.all([
      createFullNode({
        staticNoiseKey: NOISE_KEY_1,
      }).then((waku) => waku.start().then(() => waku)),
      createFullNode({
        staticNoiseKey: NOISE_KEY_2,
      }).then((waku) => waku.start().then(() => waku)),
      nwaku.getMultiaddrWithId(),
    ]);

    log("Waku nodes created");

    await Promise.all([
      waku1.dial(nimWakuMultiaddr),
      waku2.dial(nimWakuMultiaddr),
    ]);

    log("Waku nodes connected to nwaku");

    await waitForRemotePeer(waku1, [Protocols.LightPush]);

    log("Sending messages using light push");
    await Promise.all([
      waku1.lightPush.push(asymEncoder, asymMsg),
      waku1.lightPush.push(symEncoder, symMsg),
      waku1.lightPush.push(otherEncoder, otherMsg),
      waku1.lightPush.push(TestEncoder, clearMsg),
    ]);

    await waitForRemotePeer(waku2, [Protocols.Store]);

    const messages: Message[] = [];
    log("Retrieve messages from store");

    for await (const msgPromises of waku2.store.queryGenerator([
      asymDecoder,
      symDecoder,
      TestDecoder,
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

    !!waku1 && waku1.stop().catch((e) => console.log("Waku failed to stop", e));
    !!waku2 && waku2.stop().catch((e) => console.log("Waku failed to stop", e));
  });

  it("Ordered callback, using start and end time", async function () {
    this.timeout(20000);

    const now = new Date();

    const startTime = new Date();
    // Set start time 5 minutes in the past
    startTime.setTime(now.getTime() - 5 * 60 * 1000);

    const message1Timestamp = new Date();
    // Set first message was 4 minutes in the past
    message1Timestamp.setTime(now.getTime() - 4 * 60 * 1000);

    const message2Timestamp = new Date();
    // Set second message 2 minutes in the past
    message2Timestamp.setTime(now.getTime() - 2 * 60 * 1000);
    const messageTimestamps = [message1Timestamp, message2Timestamp];

    const endTime = new Date();
    // Set end time 1 minute in the past
    endTime.setTime(now.getTime() - 60 * 1000);

    for (let i = 0; i < 2; i++) {
      expect(
        await nwaku.sendMessage(
          Nwaku.toMessageRpcQuery({
            payload: utf8ToBytes(`Message ${i}`),
            contentTopic: TestContentTopic,
            timestamp: messageTimestamps[i],
          })
        )
      ).to.be.true;
    }

    waku = await createFullNode({
      staticNoiseKey: NOISE_KEY_1,
    });
    await waku.start();
    await waku.dial(await nwaku.getMultiaddrWithId());
    await waitForRemotePeer(waku, [Protocols.Store]);

    const nwakuPeerId = await nwaku.getPeerId();

    const firstMessages: Message[] = [];
    await waku.store.queryOrderedCallback(
      [TestDecoder],
      (msg) => {
        if (msg) {
          firstMessages.push(msg);
        }
      },
      {
        peerId: nwakuPeerId,
        timeFilter: { startTime, endTime: message1Timestamp },
      }
    );

    const bothMessages: Message[] = [];
    await waku.store.queryOrderedCallback(
      [TestDecoder],
      async (msg) => {
        bothMessages.push(msg);
      },
      {
        peerId: nwakuPeerId,
        timeFilter: {
          startTime,
          endTime,
        },
      }
    );

    expect(firstMessages?.length).eq(1);

    expect(bytesToUtf8(firstMessages[0].payload!)).eq("Message 0");

    expect(bothMessages?.length).eq(2);
  });

  it("Ordered callback, aborts when callback returns true", async function () {
    this.timeout(15_000);

    const totalMsgs = 20;

    for (let i = 0; i < totalMsgs; i++) {
      expect(
        await nwaku.sendMessage(
          Nwaku.toMessageRpcQuery({
            payload: utf8ToBytes(`Message ${i}`),
            contentTopic: TestContentTopic,
          })
        )
      ).to.be.true;
    }

    waku = await createFullNode({
      staticNoiseKey: NOISE_KEY_1,
    });
    await waku.start();
    await waku.dial(await nwaku.getMultiaddrWithId());
    await waitForRemotePeer(waku, [Protocols.Store]);

    const desiredMsgs = 14;
    const messages: Message[] = [];
    await waku.store.queryOrderedCallback(
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

describe("Waku Store, custom pubsub topic", () => {
  const customPubSubTopic = "/waku/2/custom-dapp/proto";
  let waku: WakuFull;
  let nwaku: Nwaku;

  beforeEach(async function () {
    this.timeout(15_000);
    nwaku = new Nwaku(makeLogFileName(this));
    await nwaku.start({
      persistMessages: true,
      store: true,
      topics: customPubSubTopic,
    });
  });

  afterEach(async function () {
    !!nwaku && nwaku.stop();
    !!waku && waku.stop().catch((e) => console.log("Waku failed to stop", e));
  });

  it("Generator, custom pubsub topic", async function () {
    this.timeout(15_000);

    const totalMsgs = 20;
    for (let i = 0; i < totalMsgs; i++) {
      expect(
        await nwaku.sendMessage(
          Nwaku.toMessageRpcQuery({
            payload: utf8ToBytes(`Message ${i}`),
            contentTopic: TestContentTopic,
          }),
          customPubSubTopic
        )
      ).to.be.true;
    }

    waku = await createFullNode({
      staticNoiseKey: NOISE_KEY_1,
      pubSubTopic: customPubSubTopic,
    });
    await waku.start();
    await waku.dial(await nwaku.getMultiaddrWithId());
    await waitForRemotePeer(waku, [Protocols.Store]);

    const messages: Message[] = [];
    let promises: Promise<void>[] = [];
    for await (const msgPromises of waku.store.queryGenerator([TestDecoder])) {
      const _promises = msgPromises.map(async (promise) => {
        const msg = await promise;
        if (msg) {
          messages.push(msg);
        }
      });

      promises = promises.concat(_promises);
    }
    await Promise.all(promises);

    expect(messages?.length).eq(totalMsgs);
    const result = messages?.findIndex((msg) => {
      return bytesToUtf8(msg.payload!) === "Message 0";
    });
    expect(result).to.not.eq(-1);
  });
});

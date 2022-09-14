import { expect } from "chai";
import debug from "debug";

import {
  makeLogFileName,
  NOISE_KEY_1,
  NOISE_KEY_2,
  Nwaku,
} from "../../test_utils";
import { createFullNode } from "../create_waku";
import {
  generatePrivateKey,
  generateSymmetricKey,
  getPublicKey,
} from "../crypto";
import type { WakuFull } from "../interfaces";
import { utf8ToBytes } from "../utils";
import { waitForRemotePeer } from "../wait_for_remote_peer";
import { Protocols } from "../waku";
import { DecryptionMethod, WakuMessage } from "../waku_message";

import { PageDirection } from "./history_rpc";

const log = debug("waku:test:store");

const TestContentTopic = "/test/1/waku-store/utf8";

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

    const messages: WakuMessage[] = [];
    let promises: Promise<void>[] = [];
    for await (const msgPromises of waku.store.queryGenerator([])) {
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
      return msg.payloadAsUtf8 === "Message 0";
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

    const messages: WakuMessage[] = [];
    let promises: Promise<void>[] = [];
    for await (const msgPromises of waku.store.queryGenerator([])) {
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

    const messages: WakuMessage[] = [];
    await waku.store.queryCallbackOnPromise([], async (msgPromise) => {
      const msg = await msgPromise;
      if (msg) {
        messages.push(msg);
      }
    });

    expect(messages?.length).eq(totalMsgs);
    const result = messages?.findIndex((msg) => {
      return msg.payloadAsUtf8 === "Message 0";
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
    const messages: WakuMessage[] = [];
    await waku.store.queryCallbackOnPromise(
      [],
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

    const messages: WakuMessage[] = [];
    await waku.store.queryOrderedCallback(
      [],
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
          return msg.payloadAsUtf8 === `Message ${index}`;
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

    let messages: WakuMessage[] = [];
    await waku.store.queryOrderedCallback(
      [],
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
          return msg.payloadAsUtf8 === `Message ${index}`;
        })
      ).to.eq(index);
    }
  });

  it("Generator, with asymmetric & symmetric encrypted messages", async function () {
    this.timeout(15_000);

    const encryptedAsymmetricMessageText =
      "This message is encrypted for me using asymmetric";
    const encryptedAsymmetricContentTopic = "/test/1/asymmetric/proto";
    const encryptedSymmetricMessageText =
      "This message is encrypted for me using symmetric encryption";
    const encryptedSymmetricContentTopic = "/test/1/symmetric/proto";
    const clearMessageText =
      "This is a clear text message for everyone to read";
    const otherEncMessageText =
      "This message is not for and I must not be able to read it";

    const privateKey = generatePrivateKey();
    const symKey = generateSymmetricKey();
    const publicKey = getPublicKey(privateKey);

    const timestamp = new Date();
    const [
      encryptedAsymmetricMessage,
      encryptedSymmetricMessage,
      clearMessage,
      otherEncMessage,
    ] = await Promise.all([
      WakuMessage.fromUtf8String(
        encryptedAsymmetricMessageText,
        encryptedAsymmetricContentTopic,
        {
          encPublicKey: publicKey,
          timestamp,
        }
      ),
      WakuMessage.fromUtf8String(
        encryptedSymmetricMessageText,
        encryptedSymmetricContentTopic,
        {
          symKey: symKey,
          timestamp: new Date(timestamp.valueOf() + 1),
        }
      ),
      WakuMessage.fromUtf8String(
        clearMessageText,
        encryptedAsymmetricContentTopic,
        { timestamp: new Date(timestamp.valueOf() + 2) }
      ),
      WakuMessage.fromUtf8String(
        otherEncMessageText,
        encryptedSymmetricContentTopic,
        {
          encPublicKey: getPublicKey(generatePrivateKey()),
          timestamp: new Date(timestamp.valueOf() + 3),
        }
      ),
    ]);

    log("Messages have been encrypted");

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
      waku1.lightPush.push(encryptedAsymmetricMessage),
      waku1.lightPush.push(encryptedSymmetricMessage),
      waku1.lightPush.push(otherEncMessage),
      waku1.lightPush.push(clearMessage),
    ]);

    await waitForRemotePeer(waku2, [Protocols.Store]);

    waku2.addDecryptionKey(symKey, {
      contentTopics: [encryptedSymmetricContentTopic],
      method: DecryptionMethod.Symmetric,
    });

    const messages: WakuMessage[] = [];
    log("Retrieve messages from store");

    for await (const msgPromises of waku2.store.queryGenerator([], {
      decryptionParams: [{ key: privateKey }],
    })) {
      for (const promise of msgPromises) {
        const msg = await promise;
        if (msg) {
          messages.push(msg);
        }
      }
    }

    expect(messages?.length).eq(3);
    if (!messages) throw "Length was tested";
    // Messages are ordered from oldest to latest within a page (1 page query)
    expect(messages[0].payloadAsUtf8).to.eq(encryptedAsymmetricMessageText);
    expect(messages[1].payloadAsUtf8).to.eq(encryptedSymmetricMessageText);
    expect(messages[2].payloadAsUtf8).to.eq(clearMessageText);

    for (const text of [
      encryptedAsymmetricMessageText,
      encryptedSymmetricMessageText,
      clearMessageText,
    ]) {
      expect(
        messages?.findIndex((msg) => {
          return msg.payloadAsUtf8 === text;
        })
      ).to.not.eq(-1);
    }

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

    const firstMessages: WakuMessage[] = [];
    await waku.store.queryOrderedCallback(
      [],
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

    const bothMessages: WakuMessage[] = [];
    await waku.store.queryOrderedCallback(
      [],
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

    expect(firstMessages[0]?.payloadAsUtf8).eq("Message 0");

    expect(bothMessages?.length).eq(2);
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

    const messages: WakuMessage[] = [];
    let promises: Promise<void>[] = [];
    for await (const msgPromises of waku.store.queryGenerator([])) {
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
      return msg.payloadAsUtf8 === "Message 0";
    });
    expect(result).to.not.eq(-1);
  });
});

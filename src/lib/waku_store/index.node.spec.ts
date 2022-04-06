import { expect } from "chai";
import debug from "debug";

import {
  makeLogFileName,
  NOISE_KEY_1,
  NOISE_KEY_2,
  Nwaku,
} from "../../test_utils";
import { delay } from "../../test_utils/delay";
import { Protocols, Waku } from "../waku";
import { DecryptionMethod, WakuMessage } from "../waku_message";
import {
  generatePrivateKey,
  generateSymmetricKey,
  getPublicKey,
} from "../waku_message/version_1";

import { PageDirection } from "./history_rpc";

const dbg = debug("waku:test:store");

const TestContentTopic = "/test/1/waku-store/utf8";

describe("Waku Store", () => {
  let waku: Waku;
  let nwaku: Nwaku;

  afterEach(async function () {
    !!nwaku && nwaku.stop();
    !!waku && waku.stop().catch((e) => console.log("Waku failed to stop", e));
  });

  it("Retrieves history", async function () {
    this.timeout(15_000);

    nwaku = new Nwaku(makeLogFileName(this));
    await nwaku.start({ persistMessages: true });

    for (let i = 0; i < 2; i++) {
      expect(
        await nwaku.sendMessage(
          Nwaku.toWakuRelayMessage(
            await WakuMessage.fromUtf8String(`Message ${i}`, TestContentTopic)
          )
        )
      ).to.be.true;
    }

    waku = await Waku.create({
      staticNoiseKey: NOISE_KEY_1,
    });
    await waku.dial(await nwaku.getMultiaddrWithId());
    await waku.waitForRemotePeer([Protocols.Store]);
    const messages = await waku.store.queryHistory([]);

    expect(messages?.length).eq(2);
    const result = messages?.findIndex((msg) => {
      return msg.payloadAsUtf8 === "Message 0";
    });
    expect(result).to.not.eq(-1);
  });

  it("Retrieves history using callback", async function () {
    this.timeout(15_000);

    nwaku = new Nwaku(makeLogFileName(this));
    await nwaku.start({ persistMessages: true });

    const totalMsgs = 20;

    for (let i = 0; i < totalMsgs; i++) {
      expect(
        await nwaku.sendMessage(
          Nwaku.toWakuRelayMessage(
            await WakuMessage.fromUtf8String(`Message ${i}`, TestContentTopic)
          )
        )
      ).to.be.true;
    }

    waku = await Waku.create({
      staticNoiseKey: NOISE_KEY_1,
    });
    await waku.dial(await nwaku.getMultiaddrWithId());
    await waku.waitForRemotePeer([Protocols.Store]);

    let messages: WakuMessage[] = [];

    await waku.store.queryHistory([], {
      callback: (_msgs) => {
        messages = messages.concat(_msgs);
      },
    });

    expect(messages?.length).eq(totalMsgs);
    const result = messages?.findIndex((msg) => {
      return msg.payloadAsUtf8 === "Message 0";
    });
    expect(result).to.not.eq(-1);
  });

  it("Retrieval aborts when callback returns true", async function () {
    this.timeout(15_000);

    nwaku = new Nwaku(makeLogFileName(this));
    await nwaku.start({ persistMessages: true });

    const availMsgs = 20;

    for (let i = 0; i < availMsgs; i++) {
      expect(
        await nwaku.sendMessage(
          Nwaku.toWakuRelayMessage(
            await WakuMessage.fromUtf8String(`Message ${i}`, TestContentTopic)
          )
        )
      ).to.be.true;
    }

    waku = await Waku.create({
      staticNoiseKey: NOISE_KEY_1,
    });
    await waku.dial(await nwaku.getMultiaddrWithId());
    await waku.waitForRemotePeer([Protocols.Store]);

    let messages: WakuMessage[] = [];
    const desiredMsgs = 14;

    await waku.store.queryHistory([], {
      pageSize: 7,
      callback: (_msgs) => {
        messages = messages.concat(_msgs);
        return messages.length >= desiredMsgs;
      },
    });

    expect(messages?.length).eq(desiredMsgs);
  });

  it("Retrieves all historical elements in chronological order through paging", async function () {
    this.timeout(15_000);

    nwaku = new Nwaku(makeLogFileName(this));
    await nwaku.start({ persistMessages: true });

    for (let i = 0; i < 15; i++) {
      expect(
        await nwaku.sendMessage(
          Nwaku.toWakuRelayMessage(
            await WakuMessage.fromUtf8String(`Message ${i}`, TestContentTopic)
          )
        )
      ).to.be.true;
    }

    waku = await Waku.create({
      staticNoiseKey: NOISE_KEY_1,
    });
    await waku.dial(await nwaku.getMultiaddrWithId());
    await waku.waitForRemotePeer([Protocols.Store]);

    const messages = await waku.store.queryHistory([], {
      pageDirection: PageDirection.FORWARD,
    });

    expect(messages?.length).eq(15);
    for (let index = 0; index < 2; index++) {
      expect(
        messages?.findIndex((msg) => {
          return msg.payloadAsUtf8 === `Message ${index}`;
        })
      ).to.eq(index);
    }
  });

  it("Retrieves history using custom pubsub topic", async function () {
    this.timeout(15_000);

    const customPubSubTopic = "/waku/2/custom-dapp/proto";
    nwaku = new Nwaku(makeLogFileName(this));
    await nwaku.start({ persistMessages: true, topics: customPubSubTopic });

    for (let i = 0; i < 2; i++) {
      expect(
        await nwaku.sendMessage(
          Nwaku.toWakuRelayMessage(
            await WakuMessage.fromUtf8String(`Message ${i}`, TestContentTopic)
          ),
          customPubSubTopic
        )
      ).to.be.true;
    }

    waku = await Waku.create({
      pubSubTopic: customPubSubTopic,
      staticNoiseKey: NOISE_KEY_1,
    });
    await waku.dial(await nwaku.getMultiaddrWithId());
    await waku.waitForRemotePeer([Protocols.Store]);

    const nimPeerId = await nwaku.getPeerId();

    const messages = await waku.store.queryHistory([], {
      peerId: nimPeerId,
    });

    expect(messages?.length).eq(2);
    const result = messages?.findIndex((msg) => {
      return msg.payloadAsUtf8 === "Message 0";
    });
    expect(result).to.not.eq(-1);
  });

  it("Retrieves history with asymmetric & symmetric encrypted messages", async function () {
    this.timeout(15_000);

    nwaku = new Nwaku(makeLogFileName(this));
    await nwaku.start({ persistMessages: true, lightpush: true });

    const encryptedAsymmetricMessageText =
      "This message is encrypted for me using asymmetric";
    const encryptedSymmetricMessageText =
      "This message is encrypted for me using symmetric encryption";
    const clearMessageText =
      "This is a clear text message for everyone to read";
    const otherEncMessageText =
      "This message is not for and I must not be able to read it";

    const privateKey = generatePrivateKey();
    const symKey = generateSymmetricKey();
    const publicKey = getPublicKey(privateKey);

    const [
      encryptedAsymmetricMessage,
      encryptedSymmetricMessage,
      clearMessage,
      otherEncMessage,
    ] = await Promise.all([
      WakuMessage.fromUtf8String(
        encryptedAsymmetricMessageText,
        TestContentTopic,
        {
          encPublicKey: publicKey,
        }
      ),
      WakuMessage.fromUtf8String(
        encryptedSymmetricMessageText,
        TestContentTopic,
        {
          symKey: symKey,
        }
      ),
      WakuMessage.fromUtf8String(clearMessageText, TestContentTopic),
      WakuMessage.fromUtf8String(otherEncMessageText, TestContentTopic, {
        encPublicKey: getPublicKey(generatePrivateKey()),
      }),
    ]);

    dbg("Messages have been encrypted");

    const [waku1, waku2, nimWakuMultiaddr] = await Promise.all([
      Waku.create({
        staticNoiseKey: NOISE_KEY_1,
      }),
      Waku.create({
        staticNoiseKey: NOISE_KEY_2,
      }),
      nwaku.getMultiaddrWithId(),
    ]);

    dbg("Waku nodes created");

    await Promise.all([
      waku1.dial(nimWakuMultiaddr),
      waku2.dial(nimWakuMultiaddr),
    ]);

    dbg("Waku nodes connected to nwaku");

    let lightPushPeerFound = false;
    while (!lightPushPeerFound) {
      await delay(100);
      for await (const _peer of waku1.lightPush.peers) {
        lightPushPeerFound = true;
        break;
      }
    }

    dbg("Sending messages using light push");
    await Promise.all([
      waku1.lightPush.push(encryptedAsymmetricMessage),
      waku1.lightPush.push(encryptedSymmetricMessage),
      waku1.lightPush.push(otherEncMessage),
      waku1.lightPush.push(clearMessage),
    ]);

    let storePeerFound = false;
    while (!storePeerFound) {
      await delay(100);
      for await (const _peer of waku2.store.peers) {
        storePeerFound = true;
        break;
      }
    }

    waku2.store.addDecryptionKey(symKey);

    dbg("Retrieve messages from store");
    const messages = await waku2.store.queryHistory([], {
      decryptionKeys: [privateKey],
    });

    expect(messages?.length).eq(3);
    if (!messages) throw "Length was tested";
    expect(messages[0].payloadAsUtf8).to.eq(clearMessageText);
    expect(messages[1].payloadAsUtf8).to.eq(encryptedSymmetricMessageText);
    expect(messages[2].payloadAsUtf8).to.eq(encryptedAsymmetricMessageText);

    !!waku1 && waku1.stop().catch((e) => console.log("Waku failed to stop", e));
    !!waku2 && waku2.stop().catch((e) => console.log("Waku failed to stop", e));
  });

  it("Retrieves history with asymmetric & symmetric encrypted messages on different content topics", async function () {
    this.timeout(15_000);

    nwaku = new Nwaku(makeLogFileName(this));
    await nwaku.start({ persistMessages: true, lightpush: true });

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
        }
      ),
      WakuMessage.fromUtf8String(
        encryptedSymmetricMessageText,
        encryptedSymmetricContentTopic,
        {
          symKey: symKey,
        }
      ),
      WakuMessage.fromUtf8String(
        clearMessageText,
        encryptedAsymmetricContentTopic
      ),
      WakuMessage.fromUtf8String(
        otherEncMessageText,
        encryptedSymmetricContentTopic,
        {
          encPublicKey: getPublicKey(generatePrivateKey()),
        }
      ),
    ]);

    dbg("Messages have been encrypted");

    const [waku1, waku2, nimWakuMultiaddr] = await Promise.all([
      Waku.create({
        staticNoiseKey: NOISE_KEY_1,
      }),
      Waku.create({
        staticNoiseKey: NOISE_KEY_2,
      }),
      nwaku.getMultiaddrWithId(),
    ]);

    dbg("Waku nodes created");

    await Promise.all([
      waku1.dial(nimWakuMultiaddr),
      waku2.dial(nimWakuMultiaddr),
    ]);

    dbg("Waku nodes connected to nwaku");

    let lightPushPeerFound = false;
    while (!lightPushPeerFound) {
      await delay(100);
      for await (const _peer of waku1.lightPush.peers) {
        lightPushPeerFound = true;
        break;
      }
    }

    dbg("Sending messages using light push");
    await Promise.all([
      waku1.lightPush.push(encryptedAsymmetricMessage),
      waku1.lightPush.push(encryptedSymmetricMessage),
      waku1.lightPush.push(otherEncMessage),
      waku1.lightPush.push(clearMessage),
    ]);

    let storePeerFound = false;
    while (!storePeerFound) {
      await delay(100);
      for await (const _peer of waku2.store.peers) {
        storePeerFound = true;
        break;
      }
    }

    waku2.addDecryptionKey(symKey, {
      contentTopics: [encryptedSymmetricContentTopic],
      method: DecryptionMethod.Symmetric,
    });

    dbg("Retrieve messages from store");
    const messages = await waku2.store.queryHistory([], {
      decryptionKeys: [privateKey],
    });

    expect(messages?.length).eq(3);
    if (!messages) throw "Length was tested";
    expect(messages[0].payloadAsUtf8).to.eq(clearMessageText);
    expect(messages[1].payloadAsUtf8).to.eq(encryptedSymmetricMessageText);
    expect(messages[2].payloadAsUtf8).to.eq(encryptedAsymmetricMessageText);

    !!waku1 && waku1.stop().catch((e) => console.log("Waku failed to stop", e));
    !!waku2 && waku2.stop().catch((e) => console.log("Waku failed to stop", e));
  });

  it("Retrieves history using start and end time", async function () {
    this.timeout(15_000);

    nwaku = new Nwaku(makeLogFileName(this));
    await nwaku.start({ persistMessages: true });

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
          Nwaku.toWakuRelayMessage(
            await WakuMessage.fromUtf8String(`Message ${i}`, TestContentTopic, {
              timestamp: messageTimestamps[i],
            })
          )
        )
      ).to.be.true;
    }

    waku = await Waku.create({
      staticNoiseKey: NOISE_KEY_1,
    });
    await waku.dial(await nwaku.getMultiaddrWithId());
    await waku.waitForRemotePeer([Protocols.Store]);

    const nwakuPeerId = await nwaku.getPeerId();

    const firstMessage = await waku.store.queryHistory([], {
      peerId: nwakuPeerId,
      timeFilter: { startTime, endTime: message1Timestamp },
    });

    const bothMessages = await waku.store.queryHistory([], {
      peerId: nwakuPeerId,
      timeFilter: {
        startTime,
        endTime,
      },
    });

    expect(firstMessage?.length).eq(1);

    expect(firstMessage[0]?.payloadAsUtf8).eq("Message 0");

    expect(bothMessages?.length).eq(2);
  });
});

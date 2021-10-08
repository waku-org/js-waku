import { expect } from 'chai';
import debug from 'debug';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore: No types available
import TCP from 'libp2p-tcp';

import {
  makeLogFileName,
  NimWaku,
  NOISE_KEY_1,
  NOISE_KEY_2,
} from '../../test_utils';
import { delay } from '../delay';
import { Waku } from '../waku';
import { WakuMessage } from '../waku_message';
import {
  generatePrivateKey,
  generateSymmetricKey,
  getPublicKey,
} from '../waku_message/version_1';

import { PageDirection } from './history_rpc';

const dbg = debug('waku:test:store');

const TestContentTopic = '/test/1/waku-store/utf8';

describe('Waku Store', () => {
  let waku: Waku;
  let nimWaku: NimWaku;

  afterEach(async function () {
    nimWaku ? nimWaku.stop() : null;
    waku ? await waku.stop() : null;
  });

  it('Retrieves history', async function () {
    this.timeout(5_000);

    nimWaku = new NimWaku(makeLogFileName(this));
    await nimWaku.start({ persistMessages: true });

    for (let i = 0; i < 2; i++) {
      expect(
        await nimWaku.sendMessage(
          await WakuMessage.fromUtf8String(`Message ${i}`, TestContentTopic)
        )
      ).to.be.true;
    }

    waku = await Waku.create({
      staticNoiseKey: NOISE_KEY_1,
      libp2p: { modules: { transport: [TCP] } },
    });
    await waku.dial(await nimWaku.getMultiaddrWithId());

    // Wait for identify protocol to finish
    await new Promise((resolve) => {
      waku.libp2p.peerStore.once('change:protocols', resolve);
    });

    const messages = await waku.store.queryHistory([]);

    expect(messages?.length).eq(2);
    const result = messages?.findIndex((msg) => {
      return msg.payloadAsUtf8 === 'Message 0';
    });
    expect(result).to.not.eq(-1);
  });

  it('Retrieves history using callback', async function () {
    this.timeout(5_000);

    nimWaku = new NimWaku(makeLogFileName(this));
    await nimWaku.start({ persistMessages: true });

    const totalMsgs = 20;

    for (let i = 0; i < totalMsgs; i++) {
      expect(
        await nimWaku.sendMessage(
          await WakuMessage.fromUtf8String(`Message ${i}`, TestContentTopic)
        )
      ).to.be.true;
    }

    waku = await Waku.create({
      staticNoiseKey: NOISE_KEY_1,
      libp2p: { modules: { transport: [TCP] } },
    });
    await waku.dial(await nimWaku.getMultiaddrWithId());

    // Wait for identify protocol to finish
    await new Promise((resolve) => {
      waku.libp2p.peerStore.once('change:protocols', resolve);
    });

    let messages: WakuMessage[] = [];

    await waku.store.queryHistory([], {
      callback: (_msgs) => {
        messages = messages.concat(_msgs);
      },
    });

    expect(messages?.length).eq(totalMsgs);
    const result = messages?.findIndex((msg) => {
      return msg.payloadAsUtf8 === 'Message 0';
    });
    expect(result).to.not.eq(-1);
  });

  it('Retrieval aborts when callback returns true', async function () {
    this.timeout(5_000);

    nimWaku = new NimWaku(makeLogFileName(this));
    await nimWaku.start({ persistMessages: true });

    const availMsgs = 20;

    for (let i = 0; i < availMsgs; i++) {
      expect(
        await nimWaku.sendMessage(
          await WakuMessage.fromUtf8String(`Message ${i}`, TestContentTopic)
        )
      ).to.be.true;
    }

    waku = await Waku.create({
      staticNoiseKey: NOISE_KEY_1,
      libp2p: { modules: { transport: [TCP] } },
    });
    await waku.dial(await nimWaku.getMultiaddrWithId());

    // Wait for identify protocol to finish
    await new Promise((resolve) => {
      waku.libp2p.peerStore.once('change:protocols', resolve);
    });

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

  it('Retrieves all historical elements in chronological order through paging', async function () {
    this.timeout(5_000);

    nimWaku = new NimWaku(makeLogFileName(this));
    await nimWaku.start({ persistMessages: true });

    for (let i = 0; i < 15; i++) {
      expect(
        await nimWaku.sendMessage(
          await WakuMessage.fromUtf8String(`Message ${i}`, TestContentTopic)
        )
      ).to.be.true;
    }

    waku = await Waku.create({
      staticNoiseKey: NOISE_KEY_1,
      libp2p: { modules: { transport: [TCP] } },
    });
    await waku.dial(await nimWaku.getMultiaddrWithId());

    // Wait for identify protocol to finish
    await new Promise((resolve) => {
      waku.libp2p.peerStore.once('change:protocols', resolve);
    });

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

  it('Retrieves history using custom pubsub topic', async function () {
    this.timeout(5_000);

    const customPubSubTopic = '/waku/2/custom-dapp/proto';
    nimWaku = new NimWaku(makeLogFileName(this));
    await nimWaku.start({ persistMessages: true, topics: customPubSubTopic });

    for (let i = 0; i < 2; i++) {
      expect(
        await nimWaku.sendMessage(
          await WakuMessage.fromUtf8String(`Message ${i}`, TestContentTopic),
          customPubSubTopic
        )
      ).to.be.true;
    }

    waku = await Waku.create({
      pubSubTopic: customPubSubTopic,
      staticNoiseKey: NOISE_KEY_1,
      libp2p: { modules: { transport: [TCP] } },
    });
    await waku.dial(await nimWaku.getMultiaddrWithId());

    // Wait for identify protocol to finish
    await new Promise((resolve) => {
      waku.libp2p.peerStore.once('change:protocols', resolve);
    });

    const nimPeerId = await nimWaku.getPeerId();

    const messages = await waku.store.queryHistory([], {
      peerId: nimPeerId,
    });

    expect(messages?.length).eq(2);
    const result = messages?.findIndex((msg) => {
      return msg.payloadAsUtf8 === 'Message 0';
    });
    expect(result).to.not.eq(-1);
  });

  it('Retrieves history with asymmetric & symmetric encrypted messages', async function () {
    this.timeout(10_000);

    nimWaku = new NimWaku(makeLogFileName(this));
    await nimWaku.start({ persistMessages: true, lightpush: true });

    const encryptedAsymmetricMessageText =
      'This message is encrypted for me using asymmetric';
    const encryptedSymmetricMessageText =
      'This message is encrypted for me using symmetric encryption';
    const clearMessageText =
      'This is a clear text message for everyone to read';
    const otherEncMessageText =
      'This message is not for and I must not be able to read it';

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

    dbg('Messages have been encrypted');

    const [waku1, waku2, nimWakuMultiaddr] = await Promise.all([
      Waku.create({
        staticNoiseKey: NOISE_KEY_1,
        libp2p: { modules: { transport: [TCP] } },
      }),
      Waku.create({
        staticNoiseKey: NOISE_KEY_2,
        libp2p: { modules: { transport: [TCP] } },
      }),
      nimWaku.getMultiaddrWithId(),
    ]);

    dbg('Waku nodes created');

    await Promise.all([
      waku1.dial(nimWakuMultiaddr),
      waku2.dial(nimWakuMultiaddr),
    ]);

    dbg('Waku nodes connected to nim Waku');

    let lightPushPeers = waku1.lightPush.peers;
    while (lightPushPeers.length == 0) {
      await delay(100);
      lightPushPeers = waku1.lightPush.peers;
    }

    dbg('Sending messages using light push');
    await Promise.all([
      waku1.lightPush.push(encryptedAsymmetricMessage),
      waku1.lightPush.push(encryptedSymmetricMessage),
      waku1.lightPush.push(otherEncMessage),
      waku1.lightPush.push(clearMessage),
    ]);

    let storePeers = waku2.store.peers;
    while (storePeers.length == 0) {
      await delay(100);
      storePeers = waku2.store.peers;
    }

    waku2.store.addDecryptionKey(symKey);

    dbg('Retrieve messages from store');
    const messages = await waku2.store.queryHistory([], {
      decryptionKeys: [privateKey],
    });

    expect(messages?.length).eq(3);
    if (!messages) throw 'Length was tested';
    expect(messages[0].payloadAsUtf8).to.eq(clearMessageText);
    expect(messages[1].payloadAsUtf8).to.eq(encryptedSymmetricMessageText);
    expect(messages[2].payloadAsUtf8).to.eq(encryptedAsymmetricMessageText);

    await Promise.all([waku1.stop(), waku2.stop()]);
  });

  it('Retrieves history using start and end time', async function () {
    this.timeout(5_000);

    nimWaku = new NimWaku(makeLogFileName(this));
    await nimWaku.start({ persistMessages: true });

    const startTime = new Date();

    const message1Timestamp = new Date();
    message1Timestamp.setTime(startTime.getTime() + 60 * 1000);
    const message2Timestamp = new Date();
    message2Timestamp.setTime(startTime.getTime() + 2 * 60 * 1000);
    const messageTimestamps = [message1Timestamp, message2Timestamp];

    const endTime = new Date();
    endTime.setTime(startTime.getTime() + 3 * 60 * 1000);

    let firstMessageTime;
    for (let i = 0; i < 2; i++) {
      expect(
        await nimWaku.sendMessage(
          await WakuMessage.fromUtf8String(`Message ${i}`, TestContentTopic, {
            timestamp: messageTimestamps[i],
          })
        )
      ).to.be.true;
      if (!firstMessageTime) firstMessageTime = Date.now() / 1000;
    }

    waku = await Waku.create({
      staticNoiseKey: NOISE_KEY_1,
      libp2p: { modules: { transport: [TCP] } },
    });
    await waku.dial(await nimWaku.getMultiaddrWithId());

    // Wait for identify protocol to finish
    await new Promise((resolve) => {
      waku.libp2p.peerStore.once('change:protocols', resolve);
    });

    const nimPeerId = await nimWaku.getPeerId();

    const firstMessage = await waku.store.queryHistory([], {
      peerId: nimPeerId,
      timeFilter: { startTime, endTime: message1Timestamp },
    });

    const bothMessages = await waku.store.queryHistory([], {
      peerId: nimPeerId,
      timeFilter: {
        startTime,
        endTime,
      },
    });

    expect(firstMessage?.length).eq(1);

    expect(firstMessage[0]?.payloadAsUtf8).eq('Message 0');

    expect(bothMessages?.length).eq(2);
  });
});

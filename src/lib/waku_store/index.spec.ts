import { expect } from 'chai';
import debug from 'debug';
import TCP from 'libp2p-tcp';

import {
  makeLogFileName,
  NimWaku,
  NOISE_KEY_1,
  NOISE_KEY_2,
} from '../../test_utils';
import { delay } from '../delay';
import { Waku } from '../waku';
import { DefaultContentTopic, WakuMessage } from '../waku_message';
import { generatePrivateKey, getPublicKey } from '../waku_message/version_1';

import { Direction } from './history_rpc';

const dbg = debug('waku:test:store');

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
          await WakuMessage.fromUtf8String(`Message ${i}`)
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

    const messages = await waku.store.queryHistory({
      contentTopics: [],
    });

    expect(messages?.length).eq(2);
    const result = messages?.findIndex((msg) => {
      return msg.payloadAsUtf8 === 'Message 0';
    });
    expect(result).to.not.eq(-1);
  });

  it('Retrieves all historical elements in chronological order through paging', async function () {
    this.timeout(5_000);

    nimWaku = new NimWaku(makeLogFileName(this));
    await nimWaku.start({ persistMessages: true });

    for (let i = 0; i < 15; i++) {
      expect(
        await nimWaku.sendMessage(
          await WakuMessage.fromUtf8String(`Message ${i}`)
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

    const messages = await waku.store.queryHistory({
      contentTopics: [DefaultContentTopic],
      direction: Direction.FORWARD,
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
          await WakuMessage.fromUtf8String(`Message ${i}`),
          customPubSubTopic
        )
      ).to.be.true;
    }

    waku = await Waku.create({
      pubsubTopic: customPubSubTopic,
      staticNoiseKey: NOISE_KEY_1,
      libp2p: { modules: { transport: [TCP] } },
    });
    await waku.dial(await nimWaku.getMultiaddrWithId());

    // Wait for identify protocol to finish
    await new Promise((resolve) => {
      waku.libp2p.peerStore.once('change:protocols', resolve);
    });

    const nimPeerId = await nimWaku.getPeerId();

    const messages = await waku.store.queryHistory({
      peerId: nimPeerId,
      contentTopics: [],
    });

    expect(messages?.length).eq(2);
    const result = messages?.findIndex((msg) => {
      return msg.payloadAsUtf8 === 'Message 0';
    });
    expect(result).to.not.eq(-1);
  });

  it('Retrieves history with asymmetric encrypted messages', async function () {
    this.timeout(10_000);

    nimWaku = new NimWaku(makeLogFileName(this));
    await nimWaku.start({ persistMessages: true, lightpush: true });

    const encryptedMessageText = 'This message is encrypted for me';
    const clearMessageText =
      'This is a clear text message for everyone to read';
    const otherEncMessageText =
      'This message is not for and I must not be able to read it';

    const privateKey = generatePrivateKey();
    const publicKey = getPublicKey(privateKey);

    const [encryptedMessage, clearMessage, otherEncMessage] = await Promise.all(
      [
        WakuMessage.fromUtf8String(encryptedMessageText, {
          encPublicKey: publicKey,
        }),
        WakuMessage.fromUtf8String(clearMessageText),
        WakuMessage.fromUtf8String(otherEncMessageText, {
          encPublicKey: getPublicKey(generatePrivateKey()),
        }),
      ]
    );

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
      await waku1.lightPush.push(encryptedMessage),
      waku1.lightPush.push(otherEncMessage),
      waku1.lightPush.push(clearMessage),
    ]);

    let storePeers = waku2.store.peers;
    while (storePeers.length == 0) {
      await delay(100);
      storePeers = waku2.store.peers;
    }

    dbg('Retrieve messages from store');
    const messages = await waku2.store.queryHistory({
      contentTopics: [],
      decryptionPrivateKeys: [privateKey],
    });

    expect(messages?.length).eq(2);
    if (!messages) throw 'Length was tested';
    expect(messages[0].payloadAsUtf8).to.eq(clearMessageText);
    expect(messages[1].payloadAsUtf8).to.eq(encryptedMessageText);

    await Promise.all([waku1.stop(), waku2.stop()]);
  });
});

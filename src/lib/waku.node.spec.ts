import { expect } from 'chai';
import PeerId from 'peer-id';

import {
  makeLogFileName,
  NimWaku,
  NOISE_KEY_1,
  NOISE_KEY_2,
} from '../test_utils/';

import { Waku } from './waku';
import { WakuMessage } from './waku_message';
import { generateSymmetricKey } from './waku_message/version_1';

const TestContentTopic = '/test/1/waku/utf8';

describe('Waku Dial [node only]', function () {
  let waku: Waku;
  let waku2: Waku;

  afterEach(async function () {
    this.timeout(10_000);

    await Promise.all([waku ? waku.stop() : null, waku2 ? waku2.stop() : null]);
  });

  describe('Bootstrap', function () {
    it('Passing a boolean', async function () {
      // This test depends on fleets.status.im being online.
      // This dependence must be removed once DNS discovery is implemented
      this.timeout(20_000);

      waku = await Waku.create({
        staticNoiseKey: NOISE_KEY_1,
        bootstrap: { default: true },
      });

      const connectedPeerID: PeerId = await new Promise((resolve) => {
        waku.libp2p.connectionManager.on('peer:connect', (connection) => {
          resolve(connection.remotePeer);
        });
      });

      expect(connectedPeerID).to.not.be.undefined;
    });

    it('Passing an array', async function () {
      this.timeout(10_000);

      waku = await Waku.create({
        staticNoiseKey: NOISE_KEY_1,
        libp2p: {
          addresses: { listen: ['/ip4/0.0.0.0/tcp/0'] },
        },
      });

      const multiAddrWithId = waku.getLocalMultiaddrWithID();

      waku2 = await Waku.create({
        staticNoiseKey: NOISE_KEY_2,
        bootstrap: { peers: [multiAddrWithId] },
      });

      const connectedPeerID: PeerId = await new Promise((resolve) => {
        waku.libp2p.connectionManager.on('peer:connect', (connection) => {
          resolve(connection.remotePeer);
        });
      });

      expect(connectedPeerID.toB58String()).to.eq(
        waku2.libp2p.peerId.toB58String()
      );
    });
  });

  describe('Bootstrap', function () {
    it('Passing a function', async function () {
      this.timeout(10_000);

      waku = await Waku.create({
        staticNoiseKey: NOISE_KEY_1,
        libp2p: {
          addresses: { listen: ['/ip4/0.0.0.0/tcp/0'] },
        },
      });

      const multiAddrWithId = waku.getLocalMultiaddrWithID();

      waku2 = await Waku.create({
        staticNoiseKey: NOISE_KEY_2,
        bootstrap: {
          getPeers: async () => {
            return [multiAddrWithId];
          },
        },
      });

      const connectedPeerID: PeerId = await new Promise((resolve) => {
        waku.libp2p.connectionManager.on('peer:connect', (connection) => {
          resolve(connection.remotePeer);
        });
      });

      expect(connectedPeerID.toB58String()).to.eq(
        waku2.libp2p.peerId.toB58String()
      );
    });
  });

  describe('Interop: Nim', function () {
    let nimWaku: NimWaku;

    afterEach(async function () {
      this.timeout(10_000);

      nimWaku ? nimWaku.stop() : null;
    });

    it('nim connects to js', async function () {
      this.timeout(10_000);

      waku = await Waku.create({
        staticNoiseKey: NOISE_KEY_1,
        libp2p: {
          addresses: { listen: ['/ip4/0.0.0.0/tcp/0'] },
        },
      });

      const multiAddrWithId = waku.getLocalMultiaddrWithID();

      nimWaku = new NimWaku(makeLogFileName(this));
      await nimWaku.start({ staticnode: multiAddrWithId });

      const nimPeers = await nimWaku.peers();

      expect(nimPeers).to.deep.equal([
        {
          multiaddr: multiAddrWithId,
          protocol: '/vac/waku/relay/2.0.0',
          connected: true,
        },
      ]);

      const nimPeerId = await nimWaku.getPeerId();
      const jsPeers = waku.libp2p.peerStore.peers;

      expect(jsPeers.has(nimPeerId.toB58String())).to.be.true;
    });
  });
});

describe('Decryption Keys', () => {
  afterEach(function () {
    if (this.currentTest?.state === 'failed') {
      console.log(`Test failed, log file name is ${makeLogFileName(this)}`);
    }
  });

  let waku1: Waku;
  let waku2: Waku;
  beforeEach(async function () {
    [waku1, waku2] = await Promise.all([
      Waku.create({ staticNoiseKey: NOISE_KEY_1 }),
      Waku.create({
        staticNoiseKey: NOISE_KEY_2,
        libp2p: { addresses: { listen: ['/ip4/0.0.0.0/tcp/0/ws'] } },
      }),
    ]);

    waku1.addPeerToAddressBook(waku2.libp2p.peerId, waku2.libp2p.multiaddrs);

    await Promise.all([
      new Promise((resolve) =>
        waku1.libp2p.pubsub.once('pubsub:subscription-change', () =>
          resolve(null)
        )
      ),
      new Promise((resolve) =>
        waku2.libp2p.pubsub.once('pubsub:subscription-change', () =>
          resolve(null)
        )
      ),
    ]);
  });

  afterEach(async function () {
    this.timeout(5000);
    await waku1.stop();
    await waku2.stop();
  });

  it('Used by Waku Relay', async function () {
    this.timeout(10000);

    const symKey = generateSymmetricKey();

    waku2.addDecryptionKey(symKey);

    const messageText = 'Message is encrypted';
    const messageTimestamp = new Date('1995-12-17T03:24:00');
    const message = await WakuMessage.fromUtf8String(
      messageText,
      TestContentTopic,
      {
        timestamp: messageTimestamp,
        symKey,
      }
    );

    const receivedMsgPromise: Promise<WakuMessage> = new Promise((resolve) => {
      waku2.relay.addObserver(resolve);
    });

    await waku1.relay.send(message);

    const receivedMsg = await receivedMsgPromise;

    expect(receivedMsg.contentTopic).to.eq(message.contentTopic);
    expect(receivedMsg.version).to.eq(message.version);
    expect(receivedMsg.payloadAsUtf8).to.eq(messageText);
    expect(receivedMsg.timestamp?.valueOf()).to.eq(messageTimestamp.valueOf());
  });
});

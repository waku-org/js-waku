import { expect } from 'chai';
import debug from 'debug';
import PeerId from 'peer-id';

import {
  makeLogFileName,
  NimWaku,
  NOISE_KEY_1,
  NOISE_KEY_2,
} from '../test_utils/';

import { delay } from './delay';
import { Waku } from './waku';
import { WakuMessage } from './waku_message';
import { generateSymmetricKey } from './waku_message/version_1';
import { RelayCodecs } from './waku_relay';

const dbg = debug('waku:test');

const TestContentTopic = '/test/1/waku/utf8';

describe('Waku Dial [node only]', function () {
  describe('Interop: Nim', function () {
    let waku: Waku;
    let nimWaku: NimWaku;

    afterEach(async function () {
      nimWaku ? nimWaku.stop() : null;
      waku ? await waku.stop() : null;
    });

    // TODO: Clarify whether nwaku's `get_waku_v2_admin_v1_peers` can be expected
    // to return peers with inbound connections.
    it.skip('js connects to nim', async function () {
      this.timeout(20_000);
      nimWaku = new NimWaku(makeLogFileName(this));
      await nimWaku.start();
      const multiAddrWithId = await nimWaku.getMultiaddrWithId();

      waku = await Waku.create({
        staticNoiseKey: NOISE_KEY_1,
      });
      await waku.dial(multiAddrWithId);
      await waku.waitForConnectedPeer([RelayCodecs]);

      let nimPeers = await nimWaku.peers();
      while (nimPeers.length === 0) {
        await delay(200);
        nimPeers = await nimWaku.peers();
        dbg('nimPeers', nimPeers);
      }

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

  describe('Bootstrap', function () {
    let waku: Waku;
    let nimWaku: NimWaku;

    afterEach(async function () {
      nimWaku ? nimWaku.stop() : null;
      waku ? await waku.stop() : null;
    });

    it('Enabling default [live data]', async function () {
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

      nimWaku = new NimWaku(makeLogFileName(this));
      await nimWaku.start();
      const multiAddrWithId = await nimWaku.getMultiaddrWithId();

      waku = await Waku.create({
        staticNoiseKey: NOISE_KEY_1,
        bootstrap: { peers: [multiAddrWithId.toString()] },
      });

      const connectedPeerID: PeerId = await new Promise((resolve) => {
        waku.libp2p.connectionManager.on('peer:connect', (connection) => {
          resolve(connection.remotePeer);
        });
      });

      expect(connectedPeerID.toB58String()).to.eq(multiAddrWithId.getPeerId());
    });

    it('Passing a function', async function () {
      this.timeout(10_000);

      nimWaku = new NimWaku(makeLogFileName(this));
      await nimWaku.start();

      waku = await Waku.create({
        staticNoiseKey: NOISE_KEY_1,
        bootstrap: {
          getPeers: async () => {
            return [await nimWaku.getMultiaddrWithId()];
          },
        },
      });

      const connectedPeerID: PeerId = await new Promise((resolve) => {
        waku.libp2p.connectionManager.on('peer:connect', (connection) => {
          resolve(connection.remotePeer);
        });
      });

      const multiAddrWithId = await nimWaku.getMultiaddrWithId();
      expect(connectedPeerID.toB58String()).to.eq(multiAddrWithId.getPeerId());
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

import { expect } from 'chai';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore: No types available
import TCP from 'libp2p-tcp';
import PeerId from 'peer-id';

import {
  makeLogFileName,
  NimWaku,
  NOISE_KEY_1,
  NOISE_KEY_2,
} from '../test_utils/';

import { Waku } from './waku';

describe('Waku Dial', function () {
  let waku: Waku;
  let waku2: Waku;
  let nimWaku: NimWaku;

  afterEach(async function () {
    this.timeout(10_000);

    nimWaku ? nimWaku.stop() : null;

    await Promise.all([waku ? waku.stop() : null, waku2 ? waku2.stop() : null]);
  });

  describe('Bootstrap', function () {
    it('Passing an array', async function () {
      this.timeout(10_000);

      waku = await Waku.create({
        staticNoiseKey: NOISE_KEY_1,
        libp2p: {
          addresses: { listen: ['/ip4/0.0.0.0/tcp/0'] },
          modules: { transport: [TCP] },
        },
      });

      const multiAddrWithId = waku.getLocalMultiaddrWithID();

      waku2 = await Waku.create({
        staticNoiseKey: NOISE_KEY_2,
        libp2p: {
          modules: { transport: [TCP] },
        },
        bootstrap: [multiAddrWithId],
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
          modules: { transport: [TCP] },
        },
      });

      const multiAddrWithId = waku.getLocalMultiaddrWithID();

      waku2 = await Waku.create({
        staticNoiseKey: NOISE_KEY_2,
        libp2p: {
          modules: { transport: [TCP] },
        },
        bootstrap: () => {
          return [multiAddrWithId];
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
    it('nim connects to js', async function () {
      this.timeout(10_000);

      waku = await Waku.create({
        staticNoiseKey: NOISE_KEY_1,
        libp2p: {
          addresses: { listen: ['/ip4/0.0.0.0/tcp/0'] },
          modules: { transport: [TCP] },
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

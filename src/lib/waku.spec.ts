import { expect } from 'chai';
import TCP from 'libp2p-tcp';

import {
  makeLogFileName,
  NimWaku,
  NOISE_KEY_1,
  NOISE_KEY_2,
} from '../test_utils/';

import { Waku } from './waku';
import { RelayCodec } from './waku_relay';

describe('Waku Dial', function () {
  it('js connects to js', async function () {
    this.timeout(10_000);
    const [waku1, waku2] = await Promise.all([
      Waku.create({
        staticNoiseKey: NOISE_KEY_1,
        libp2p: { addresses: { listen: ['/ip4/0.0.0.0/tcp/0/ws'] } },
      }),
      Waku.create({ staticNoiseKey: NOISE_KEY_2 }),
    ]);
    const waku1MultiAddrWithId = waku1.getLocalMultiaddrWithID();

    await waku2.dial(waku1MultiAddrWithId);

    const waku2PeerId = waku2.libp2p.peerId;

    const waku1Peers = waku1.libp2p.peerStore.peers;

    expect(waku1Peers.has(waku2PeerId.toB58String())).to.be.true;

    await Promise.all([waku1.stop(), waku2.stop()]);
  });

  describe('Interop: Nim', function () {
    it('nim connects to js', async function () {
      this.timeout(10_000);
      const waku = await Waku.create({
        staticNoiseKey: NOISE_KEY_1,
        libp2p: {
          addresses: { listen: ['/ip4/0.0.0.0/tcp/0'] },
          modules: { transport: [TCP] },
        },
      });

      const multiAddrWithId = waku.getLocalMultiaddrWithID();

      const nimWaku = new NimWaku(makeLogFileName(this));
      await nimWaku.start({ staticnode: multiAddrWithId });

      const nimPeers = await nimWaku.peers();

      expect(nimPeers).to.deep.equal([
        {
          multiaddr: multiAddrWithId,
          protocol: RelayCodec,
          connected: true,
        },
      ]);

      const nimPeerId = await nimWaku.getPeerId();
      const jsPeers = waku.libp2p.peerStore.peers;

      expect(jsPeers.has(nimPeerId.toB58String())).to.be.true;

      nimWaku.stop();
      await waku.stop();
    });
  });
});

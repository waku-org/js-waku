import { expect } from 'chai';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore: No types available
import TCP from 'libp2p-tcp';

import { makeLogFileName, NimWaku, NOISE_KEY_1 } from '../test_utils/';

import { Waku } from './waku';

describe('Waku Dial', function () {
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
          protocol: '/vac/waku/relay/2.0.0-beta2',
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

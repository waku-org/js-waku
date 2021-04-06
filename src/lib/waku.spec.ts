import { expect } from 'chai';

import { makeLogFileName, NimWaku, NOISE_KEY_1 } from '../test_utils/';

import Waku from './waku';
import { RelayCodec } from './waku_relay';

describe('Waku', function () {
  describe('Interop: Nim', function () {
    it('nim connects to js', async function () {
      this.timeout(10_000);
      const waku = await Waku.create({ staticNoiseKey: NOISE_KEY_1 });

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

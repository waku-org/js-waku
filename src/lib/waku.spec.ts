import { NimWaku } from '../test_utils/nim_waku';

import Waku from './waku';
import { CODEC } from './waku_relay';

describe('Waku', () => {
  describe('Interop: Nim', () => {
    test('nim connects to js', async () => {
      const waku = await Waku.create();

      const peerId = waku.libp2p.peerId.toB58String();

      const localMultiaddr = waku.libp2p.multiaddrs.find((addr) =>
        addr.toString().match(/127\.0\.0\.1/)
      );
      const multiAddrWithId = localMultiaddr + '/p2p/' + peerId;

      const nimWaku = new NimWaku(expect.getState().currentTestName);
      await nimWaku.start({ staticnode: multiAddrWithId });

      const nimPeers = await nimWaku.peers();

      expect(nimPeers).toEqual([
        {
          multiaddr: multiAddrWithId,
          protocol: CODEC,
          connected: true,
        },
      ]);

      const nimPeerId = await nimWaku.getPeerId();
      const jsPeers = waku.libp2p.peerStore.peers;

      expect(jsPeers.has(nimPeerId.toB58String())).toBeTruthy();
    });
  });
});

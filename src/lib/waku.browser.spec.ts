import { expect } from 'chai';

import { NOISE_KEY_1, NOISE_KEY_2 } from '../test_utils/';

import { Waku } from './waku';

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
});

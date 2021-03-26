import Libp2p from 'libp2p';
import Mplex from 'libp2p-mplex';
import { bytes } from 'libp2p-noise/dist/src/@types/basic';
import { Noise } from 'libp2p-noise/dist/src/noise';
import TCP from 'libp2p-tcp';
import Multiaddr from 'multiaddr';
import PeerId from 'peer-id';

import { CODEC, WakuRelay, WakuRelayPubsub } from './waku_relay';

export default class Waku {
  private constructor(public libp2p: Libp2p, public relay: WakuRelay) {}

  /**
   * Create new waku node
   * @param staticNoiseKey: A static key to use for noise,
   * mainly used for test to reduce entropy usage.
   * @returns {Promise<Waku>}
   */
  static async create(staticNoiseKey?: bytes): Promise<Waku> {
    const libp2p = await Libp2p.create({
      addresses: {
        listen: ['/ip4/0.0.0.0/tcp/0'],
      },
      modules: {
        transport: [TCP],
        streamMuxer: [Mplex],
        connEncryption: [new Noise(staticNoiseKey)],
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore: Type needs update
        pubsub: WakuRelayPubsub,
      },
    });

    await libp2p.start();

    return new Waku(libp2p, new WakuRelay(libp2p.pubsub));
  }

  async dialWithMultiAddr(peerId: PeerId, multiaddr: Multiaddr[]) {
    this.libp2p.peerStore.addressBook.set(peerId, multiaddr);
    await this.libp2p.dialProtocol(peerId, CODEC);
  }

  async stop() {
    await this.libp2p.stop();
  }
}

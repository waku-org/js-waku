import Libp2p from 'libp2p';
import Mplex from 'libp2p-mplex';
import { NOISE } from 'libp2p-noise';
import TCP from 'libp2p-tcp';

import { WakuRelay, WakuRelayPubsub } from './waku_relay';

export default class Waku {
  private constructor(public libp2p: Libp2p, public relay: WakuRelay) {}

  static async create(): Promise<Waku> {
    const libp2p = await Libp2p.create({
      addresses: {
        listen: ['/ip4/0.0.0.0/tcp/0'],
      },
      modules: {
        transport: [TCP],
        streamMuxer: [Mplex],
        connEncryption: [NOISE],
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore: Type needs update
        pubsub: WakuRelayPubsub,
      },
    });

    await libp2p.start();

    return new Waku(libp2p, new WakuRelay(libp2p.pubsub));
  }
}

import Libp2p from 'libp2p';
import Mplex from 'libp2p-mplex';
import { bytes } from 'libp2p-noise/dist/src/@types/basic';
import { Noise } from 'libp2p-noise/dist/src/noise';
import TCP from 'libp2p-tcp';
import Multiaddr from 'multiaddr';
import PeerId from 'peer-id';

import { RelayCodec, WakuRelay, WakuRelayPubsub } from './waku_relay';

export interface CreateOptions {
  listenAddresses: string[];
  staticNoiseKey: bytes | undefined;
}

export default class Waku {
  private constructor(public libp2p: Libp2p, public relay: WakuRelay) {}

  /**
   * Create new waku node
   * @param listenAddresses: Array of Multiaddrs on which the node should listen. If not present, defaults to ['/ip4/0.0.0.0/tcp/0'].
   * @param staticNoiseKey: A static key to use for noise,
   * mainly used for test to reduce entropy usage.
   * @returns {Promise<Waku>}
   */
  static async create(options: Partial<CreateOptions>): Promise<Waku> {
    const opts = Object.assign(
      {
        listenAddresses: ['/ip4/0.0.0.0/tcp/0'],
        staticNoiseKey: undefined,
      },
      options
    );

    const libp2p = await Libp2p.create({
      addresses: {
        listen: opts.listenAddresses,
      },
      modules: {
        transport: [TCP],
        streamMuxer: [Mplex],
        connEncryption: [new Noise(opts.staticNoiseKey)],
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore: Type needs update
        pubsub: WakuRelayPubsub,
      },
    });

    await libp2p.start();

    return new Waku(libp2p, new WakuRelay(libp2p.pubsub));
  }

  /**
   * Dials to the provided peer. If successful, the known metadata of the peer will be added to the nodes peerStore, and the Connection will be returned
   * @param peer The peer to dial
   */
  async dial(peer: PeerId | Multiaddr | string) {
    return this.libp2p.dialProtocol(peer, RelayCodec);
  }

  async dialWithMultiAddr(peerId: PeerId, multiaddr: Multiaddr[]) {
    this.libp2p.peerStore.addressBook.set(peerId, multiaddr);
    await this.libp2p.dialProtocol(peerId, RelayCodec);
  }

  async stop() {
    await this.libp2p.stop();
  }

  /**
   * Return the local multiaddr with peer id on which libp2p is listening.
   * @throws if libp2p is not listening on localhost
   */
  getLocalMultiaddrWithID(): string {
    const localMultiaddr = this.libp2p.multiaddrs.find((addr) =>
      addr.toString().match(/127\.0\.0\.1/)
    );
    if (!localMultiaddr || localMultiaddr.toString() === '') {
      throw 'Not listening on localhost';
    }
    const multiAddrWithId =
      localMultiaddr + '/p2p/' + this.libp2p.peerId.toB58String();
    return multiAddrWithId;
  }
}

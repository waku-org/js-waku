import Libp2p from 'libp2p';
import Mplex from 'libp2p-mplex';
import { bytes } from 'libp2p-noise/dist/src/@types/basic';
import { Noise } from 'libp2p-noise/dist/src/noise';
import TCP from 'libp2p-tcp';
import Multiaddr from 'multiaddr';
import pTimeout from 'p-timeout';
import PeerId from 'peer-id';

import { delay } from './delay';
import { RelayCodec, WakuRelay, WakuRelayPubsub } from './waku_relay';
import { StoreCodec, WakuStore } from './waku_store';

const WaitForIdentityFreqMs = 50;
const WaitForIdentityTimeoutMs = 2_000;

export interface CreateOptions {
  listenAddresses: string[];
  staticNoiseKey: bytes | undefined;
}

export default class Waku {
  private constructor(
    public libp2p: Libp2p,
    public relay: WakuRelay,
    public store: WakuStore
  ) {}

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

    const wakuStore = new WakuStore(libp2p);

    await libp2p.start();

    return new Waku(libp2p, new WakuRelay(libp2p.pubsub), wakuStore);
  }

  /**
   * Dials to the provided peer.
   * @param peer The peer to dial
   */
  async dial(peer: PeerId | Multiaddr | string) {
    await this.libp2p.dialProtocol(peer, [RelayCodec, StoreCodec]);
    const peerId = toPeerId(peer);
    await this.waitForIdentify(
      peerId,
      WaitForIdentityFreqMs,
      WaitForIdentityTimeoutMs
    );
  }

  async dialWithMultiAddr(peerId: PeerId, multiaddr: Multiaddr[]) {
    this.libp2p.peerStore.addressBook.set(peerId, multiaddr);
    await this.libp2p.dialProtocol(peerId, RelayCodec);
    await this.waitForIdentify(
      peerId,
      WaitForIdentityFreqMs,
      WaitForIdentityTimeoutMs
    );
  }

  /**
   * Wait for the identify protocol to be finished. This helps ensure
   * we know what protocols the peer implements
   * @param peerId
   * @param frequencyMilliseconds
   * @param maxTimeoutMilliseconds
   * @throws If there is no known connection with this peer.
   */
  async waitForIdentify(
    peerId: PeerId,
    frequencyMilliseconds: number,
    maxTimeoutMilliseconds: number
  ): Promise<void> {
    const checkProtocols = this._waitForIdentify.bind(
      this,
      peerId,
      frequencyMilliseconds
    )();

    await pTimeout(checkProtocols, maxTimeoutMilliseconds);
  }

  async _waitForIdentify(peerId: PeerId, frequencyMilliseconds: number) {
    while (true) {
      const peer = this.libp2p.peerStore.get(peerId);
      if (!peer) throw 'No connection to peer';
      if (peer.protocols.length > 0) {
        return;
      } else {
        await delay(frequencyMilliseconds);
      }
    }
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

function toPeerId(peer: PeerId | Multiaddr | string): PeerId {
  if (typeof peer === 'string') {
    peer = new Multiaddr(peer);
  }

  if (Multiaddr.isMultiaddr(peer)) {
    try {
      peer = PeerId.createFromB58String(peer.getPeerId());
    } catch (err) {
      throw `${peer} is not a valid peer type`;
    }
  }
  return peer;
}

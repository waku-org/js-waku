import Libp2p, { Libp2pModules, Libp2pOptions } from 'libp2p';
import Mplex from 'libp2p-mplex';
import { bytes } from 'libp2p-noise/dist/src/@types/basic';
import { Noise } from 'libp2p-noise/dist/src/noise';
import Websockets from 'libp2p-websockets';
import filters from 'libp2p-websockets/src/filters';
import { Multiaddr, multiaddr } from 'multiaddr';
import PeerId from 'peer-id';

import { WakuLightPush } from './waku_light_push';
import { RelayCodec, WakuRelay } from './waku_relay';
import { StoreCodec, WakuStore } from './waku_store';

const websocketsTransportKey = Websockets.prototype[Symbol.toStringTag];

export interface CreateOptions {
  /**
   * You can pass options to the `Libp2p` instance used by {@link Waku} using the {@link CreateOptions.libp2p} property.
   * This property is the same type than the one passed to [`Libp2p.create`](https://github.com/libp2p/js-libp2p/blob/master/doc/API.md#create)
   * apart that we made the `modules` property optional and partial,
   * allowing its omission and letting Waku set good defaults.
   * Notes that some values are overridden by {@link Waku} to ensure it implements the Waku protocol.
   */
  libp2p?: Omit<Libp2pOptions & import('libp2p').CreateOptions, 'modules'> & {
    modules?: Partial<Libp2pModules>;
  };
  /**
   * Byte array used as key for the noise protocol used for connection encryption
   * by [`Libp2p.create`](https://github.com/libp2p/js-libp2p/blob/master/doc/API.md#create)
   * This is only used for test purposes to not run out of entropy during CI runs.
   */
  staticNoiseKey?: bytes;
}

export class Waku {
  public libp2p: Libp2p;
  public relay: WakuRelay;
  public store: WakuStore;
  public lightPush: WakuLightPush;

  private constructor(
    libp2p: Libp2p,
    store: WakuStore,
    lightPush: WakuLightPush
  ) {
    this.libp2p = libp2p;
    this.relay = (libp2p.pubsub as unknown) as WakuRelay;
    this.store = store;
    this.lightPush = lightPush;
  }

  /**
   * Create new waku node
   *
   * @param options Takes the same options than `Libp2p`.
   */
  static async create(options?: CreateOptions): Promise<Waku> {
    // Get an object in case options or libp2p are undefined
    const libp2pOpts = Object.assign({}, options?.libp2p);

    // Default for Websocket filter is `all`:
    // Returns all TCP and DNS based addresses, both with ws or wss.
    libp2pOpts.config = Object.assign(
      {
        transport: {
          [websocketsTransportKey]: {
            filter: filters.all,
          },
        },
      },
      options?.libp2p?.config
    );

    libp2pOpts.modules = Object.assign({}, options?.libp2p?.modules);

    // Default transport for libp2p is Websockets
    libp2pOpts.modules = Object.assign(
      {
        transport: [Websockets],
      },
      options?.libp2p?.modules
    );

    // streamMuxer, connection encryption and pubsub are overridden
    // as those are the only ones currently supported by Waku nodes.
    libp2pOpts.modules = Object.assign(libp2pOpts.modules, {
      streamMuxer: [Mplex],
      connEncryption: [new Noise(options?.staticNoiseKey)],
      pubsub: WakuRelay,
    });

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore: modules property is correctly set thanks to voodoo
    const libp2p = await Libp2p.create(libp2pOpts);

    const wakuStore = new WakuStore(libp2p);
    const wakuLightPush = new WakuLightPush(libp2p);

    await libp2p.start();

    return new Waku(libp2p, wakuStore, wakuLightPush);
  }

  /**
   * Dials to the provided peer.
   *
   * @param peer The peer to dial
   */
  async dial(
    peer: PeerId | Multiaddr | string
  ): Promise<{
    stream: import('libp2p-interfaces/src/stream-muxer/types').MuxedStream;
    protocol: string;
  }> {
    return this.libp2p.dialProtocol(peer, [RelayCodec, StoreCodec]);
  }

  /**
   * Add peer to address book, it will be auto-dialed in the background.
   */
  addPeerToAddressBook(
    peerId: PeerId | string,
    multiaddrs: Multiaddr[] | string[]
  ): void {
    let peer;
    if (typeof peerId === 'string') {
      peer = PeerId.createFromB58String(peerId);
    } else {
      peer = peerId;
    }
    const addresses = multiaddrs.map((addr: Multiaddr | string) => {
      if (typeof addr === 'string') {
        return multiaddr(addr);
      } else {
        return addr;
      }
    });
    this.libp2p.peerStore.addressBook.set(peer, addresses);
  }

  async stop(): Promise<void> {
    return this.libp2p.stop();
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
    return localMultiaddr + '/p2p/' + this.libp2p.peerId.toB58String();
  }
}

import Libp2p, { Connection, Libp2pModules, Libp2pOptions } from 'libp2p';
import { MuxedStream } from 'libp2p-interfaces/dist/src/stream-muxer/types';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore: No types available
import Mplex from 'libp2p-mplex';
import { bytes } from 'libp2p-noise/dist/src/@types/basic';
import { Noise } from 'libp2p-noise/dist/src/noise';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore: No types available
import Websockets from 'libp2p-websockets';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore: No types available
import filters from 'libp2p-websockets/src/filters';
import Ping from 'libp2p/src/ping';
import { Multiaddr, multiaddr } from 'multiaddr';
import PeerId from 'peer-id';

import { WakuLightPush } from './waku_light_push';
import { RelayCodec, WakuRelay } from './waku_relay';
import { StoreCodec, WakuStore } from './waku_store';

const websocketsTransportKey = Websockets.prototype[Symbol.toStringTag];

export interface CreateOptions {
  /**
   * The PubSub Topic to use. Defaults to {@link DefaultPubsubTopic}.
   *
   * One and only one pubsub topic is used by Waku. This is used by:
   * - WakuRelay to receive, route and send messages,
   * - WakuLightPush to send messages,
   * - WakuStore to retrieve messages.
   *
   * The usage of the default pubsub topic is recommended.
   * See [Waku v2 Topic Usage Recommendations](https://rfc.vac.dev/spec/23/) for details.
   *
   * @default {@link DefaultPubsubTopic}
   */
  pubsubTopic?: string;
  /**
   * Set keep alive frequency in seconds: Waku will send a ping request to each peer
   * after the set number of seconds. Set to 0 to disable the keep alive feature
   *
   * @default 0
   */
  keepAlive?: number;
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

  private keepAliveTimers: {
    [peer: string]: ReturnType<typeof setInterval>;
  };

  private constructor(
    options: CreateOptions,
    libp2p: Libp2p,
    store: WakuStore,
    lightPush: WakuLightPush
  ) {
    this.libp2p = libp2p;
    this.relay = libp2p.pubsub as unknown as WakuRelay;
    this.store = store;
    this.lightPush = lightPush;
    this.keepAliveTimers = {};

    const keepAlive = options.keepAlive || 0;

    if (keepAlive !== 0) {
      libp2p.connectionManager.on('peer:connect', (connection: Connection) => {
        this.startKeepAlive(connection.remotePeer, keepAlive);
      });

      libp2p.connectionManager.on(
        'peer:disconnect',
        (connection: Connection) => {
          this.stopKeepAlive(connection.remotePeer);
        }
      );
    }
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

    // Pass pubsub topic to relay
    if (options?.pubsubTopic) {
      libp2pOpts.config.pubsub = Object.assign(
        { pubsubTopic: options.pubsubTopic },
        libp2pOpts.config.pubsub
      );
    }

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

    const wakuStore = new WakuStore(libp2p, {
      pubsubTopic: options?.pubsubTopic,
    });
    const wakuLightPush = new WakuLightPush(libp2p);

    await libp2p.start();

    return new Waku(options ? options : {}, libp2p, wakuStore, wakuLightPush);
  }

  /**
   * Dials to the provided peer.
   *
   * @param peer The peer to dial
   */
  async dial(peer: PeerId | Multiaddr | string): Promise<{
    stream: MuxedStream;
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

  private startKeepAlive(peerId: PeerId, periodSecs: number): void {
    // Just in case a timer already exist for this peer
    this.stopKeepAlive(peerId);

    const peerIdStr = peerId.toB58String();
    this.keepAliveTimers[peerIdStr] = setInterval(() => {
      Ping(this.libp2p, peerId);
    }, periodSecs * 1000);
  }

  private stopKeepAlive(peerId: PeerId): void {
    const peerIdStr = peerId.toB58String();
    if (this.keepAliveTimers[peerIdStr]) {
      clearInterval(this.keepAliveTimers[peerIdStr]);
      delete this.keepAliveTimers[peerIdStr];
    }
  }
}

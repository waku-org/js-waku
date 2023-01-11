import type { Stream } from "@libp2p/interface-connection";
import type { PeerId } from "@libp2p/interface-peer-id";
import type { PubSub } from "@libp2p/interface-pubsub";
import type { Multiaddr } from "@multiformats/multiaddr";
import type {
  IFilter,
  ILightPush,
  IPeerExchange,
  IRelay,
  IStore,
  PeerExchangeComponents,
  Waku,
} from "@waku/interfaces";
import { Protocols } from "@waku/interfaces";
import { PeerExchangeCodec } from "@waku/peer-exchange";
import debug from "debug";
import type { Libp2p } from "libp2p";

import { ConnectionManager } from "./ConnectionManager.js";
import { FilterCodec, FilterComponents } from "./filter/index.js";
import { LightPushCodec, LightPushComponents } from "./light_push/index.js";
import * as relayConstants from "./relay/constants.js";
import { RelayCodecs } from "./relay/constants.js";
import { StoreCodec, StoreComponents } from "./store/index.js";

export const DefaultPingKeepAliveValueSecs = 0;
export const DefaultRelayKeepAliveValueSecs = 5 * 60;
export const DefaultUserAgent = "js-waku";

const log = debug("waku:waku");

export interface WakuOptions {
  /**
   * Set keep alive frequency in seconds: Waku will send a `/ipfs/ping/1.0.0`
   * request to each peer after the set number of seconds. Set to 0 to disable.
   *
   * @default {@link DefaultPingKeepAliveValueSecs}
   */
  pingKeepAlive?: number;
  /**
   * Set keep alive frequency in seconds: Waku will send a ping message over
   * relay to each peer after the set number of seconds. Set to 0 to disable.
   *
   * @default {@link DefaultRelayKeepAliveValueSecs}
   */
  relayKeepAlive?: number;
  /**
   * Set the user agent string to be used in identification of the node.
   * @default {@link DefaultUserAgent}
   */
  userAgent?: string;
}

export class WakuNode implements Waku {
  public libp2p: Libp2p;
  public relay?: IRelay;
  public store?: IStore;
  public filter?: IFilter;
  public lightPush?: ILightPush;
  public peerExchange?: IPeerExchange;
  public connectionManager: ConnectionManager;

  constructor(
    options: WakuOptions,
    libp2p: Libp2p,
    store?: (components: StoreComponents) => IStore,
    lightPush?: (components: LightPushComponents) => ILightPush,
    filter?: (components: FilterComponents) => IFilter,
    peerExchange?: (components: PeerExchangeComponents) => IPeerExchange
  ) {
    this.libp2p = libp2p;

    const { peerStore, connectionManager, registrar } = libp2p;
    const components = { peerStore, connectionManager, registrar };

    if (store) {
      this.store = store(components);
    }
    if (filter) {
      this.filter = filter(components);
    }
    if (lightPush) {
      this.lightPush = lightPush(components);
    }

    if (peerExchange) {
      this.peerExchange = peerExchange(components);
    }

    if (isRelay(libp2p.pubsub)) {
      this.relay = libp2p.pubsub;
    }

    const pingKeepAlive =
      options.pingKeepAlive || DefaultPingKeepAliveValueSecs;
    const relayKeepAlive = this.relay
      ? options.relayKeepAlive || DefaultRelayKeepAliveValueSecs
      : 0;

    this.connectionManager = ConnectionManager.create(libp2p, {
      relayKeepAlive,
      pingKeepAlive,
    });

    log(
      "Waku node created",
      this.libp2p.peerId.toString(),
      `relay: ${!!this.relay}, store: ${!!this.store}, light push: ${!!this
        .lightPush}, filter: ${!!this.filter}, peer exchange: ${!!this
        .peerExchange} `
    );
  }

  /**
   * Dials to the provided peer.
   *
   * @param peer The peer to dial
   * @param protocols Waku protocols we expect from the peer; Defaults to mounted protocols
   */
  async dial(
    peer: PeerId | Multiaddr,
    protocols?: Protocols[]
  ): Promise<Stream> {
    const _protocols = protocols ?? [];

    if (typeof protocols === "undefined") {
      this.relay && _protocols.push(Protocols.Relay);
      this.store && _protocols.push(Protocols.Store);
      this.filter && _protocols.push(Protocols.Filter);
      this.lightPush && _protocols.push(Protocols.LightPush);
      this.peerExchange && _protocols.push(Protocols.PeerExchange);
    }

    const codecs: string[] = [];
    if (_protocols.includes(Protocols.Relay)) {
      RelayCodecs.forEach((codec) => codecs.push(codec));
    }
    if (_protocols.includes(Protocols.Store)) {
      codecs.push(StoreCodec);
    }
    if (_protocols.includes(Protocols.LightPush)) {
      codecs.push(LightPushCodec);
    }
    if (_protocols.includes(Protocols.Filter)) {
      codecs.push(FilterCodec);
    }

    if (_protocols.includes(Protocols.PeerExchange)) {
      codecs.push(PeerExchangeCodec);
    }

    log(`Dialing to ${peer.toString()} with protocols ${_protocols}`);

    return this.libp2p.dialProtocol(peer, codecs);
  }

  async start(): Promise<void> {
    await this.libp2p.start();
  }

  async stop(): Promise<void> {
    this.connectionManager.stopAllKeepAlives();
    await this.libp2p.stop();
  }

  isStarted(): boolean {
    return this.libp2p.isStarted();
  }

  /**
   * Return the local multiaddr with peer id on which libp2p is listening.
   *
   * @throws if libp2p is not listening on localhost.
   */
  getLocalMultiaddrWithID(): string {
    const localMultiaddr = this.libp2p
      .getMultiaddrs()
      .find((addr) => addr.toString().match(/127\.0\.0\.1/));
    if (!localMultiaddr || localMultiaddr.toString() === "") {
      throw "Not listening on localhost";
    }
    return localMultiaddr + "/p2p/" + this.libp2p.peerId.toString();
  }
}

function isRelay(pubsub: PubSub): pubsub is IRelay {
  if (pubsub) {
    try {
      return pubsub.multicodecs.includes(
        relayConstants.RelayCodecs[relayConstants.RelayCodecs.length - 1]
      );
      // Exception is expected if `libp2p` was not instantiated with pubsub
      // eslint-disable-next-line no-empty
    } catch (e) {}
  }
  return false;
}

import type { Stream } from "@libp2p/interface/connection";
import { isPeerId, PeerId } from "@libp2p/interface/peer-id";
import { multiaddr, Multiaddr, MultiaddrInput } from "@multiformats/multiaddr";
import type {
  IFilter,
  ILightPush,
  IRelay,
  IStore,
  Libp2p,
  PubSubTopic,
  Waku
} from "@waku/interfaces";
import { Protocols } from "@waku/interfaces";
import debug from "debug";

import { ConnectionManager } from "./connection_manager.js";

export const DefaultPingKeepAliveValueSecs = 0;
export const DefaultRelayKeepAliveValueSecs = 5 * 60;
export const DefaultUserAgent = "js-waku";

const log = debug("waku:waku");

export interface WakuOptions {
  /**
   * Set keep alive frequency in seconds: Waku will send a `/ipfs/ping/1.0.0`
   * request to each peer after the set number of seconds. Set to 0 to disable.
   *
   * @default {@link @waku/core.DefaultPingKeepAliveValueSecs}
   */
  pingKeepAlive?: number;
  /**
   * Set keep alive frequency in seconds: Waku will send a ping message over
   * relay to each peer after the set number of seconds. Set to 0 to disable.
   *
   * @default {@link @waku/core.DefaultRelayKeepAliveValueSecs}
   */
  relayKeepAlive?: number;
  /**
   * Set the user agent string to be used in identification of the node.
   * @default {@link @waku/core.DefaultUserAgent}
   */
  userAgent?: string;
}

export class WakuNode implements Waku {
  public libp2p: Libp2p;
  public relay?: IRelay;
  public store?: IStore;
  public filter?: IFilter;
  public lightPush?: ILightPush;
  public connectionManager: ConnectionManager;

  constructor(
    options: WakuOptions,
    public readonly pubsubTopics: PubSubTopic[],
    libp2p: Libp2p,
    store?: (libp2p: Libp2p) => IStore,
    lightPush?: (libp2p: Libp2p) => ILightPush,
    filter?: (libp2p: Libp2p) => IFilter,
    relay?: (libp2p: Libp2p) => IRelay
  ) {
    this.libp2p = libp2p;

    if (store) {
      this.store = store(libp2p);
    }
    if (filter) {
      this.filter = filter(libp2p);
    }
    if (lightPush) {
      this.lightPush = lightPush(libp2p);
    }

    if (relay) {
      this.relay = relay(libp2p);
    }

    const pingKeepAlive =
      options.pingKeepAlive || DefaultPingKeepAliveValueSecs;
    const relayKeepAlive = this.relay
      ? options.relayKeepAlive || DefaultRelayKeepAliveValueSecs
      : 0;

    const peerId = this.libp2p.peerId.toString();

    this.connectionManager = ConnectionManager.create(
      peerId,
      libp2p,
      { pingKeepAlive, relayKeepAlive },
      pubsubTopics,
      this.relay
    );

    log(
      "Waku node created",
      peerId,
      `relay: ${!!this.relay}, store: ${!!this.store}, light push: ${!!this
        .lightPush}, filter: ${!!this.filter}`
    );
  }

  /**
   * Dials to the provided peer.
   *
   * @param peer The peer to dial
   * @param protocols Waku protocols we expect from the peer; Defaults to mounted protocols
   */
  async dial(
    peer: PeerId | MultiaddrInput,
    protocols?: Protocols[]
  ): Promise<Stream> {
    const _protocols = protocols ?? [];
    const peerId = mapToPeerIdOrMultiaddr(peer);

    if (typeof protocols === "undefined") {
      this.relay && _protocols.push(Protocols.Relay);
      this.store && _protocols.push(Protocols.Store);
      this.filter && _protocols.push(Protocols.Filter);
      this.lightPush && _protocols.push(Protocols.LightPush);
    }

    const codecs: string[] = [];
    if (_protocols.includes(Protocols.Relay)) {
      if (this.relay) {
        this.relay.gossipSub.multicodecs.forEach((codec: string) =>
          codecs.push(codec)
        );
      } else {
        log(
          "Relay codec not included in dial codec: protocol not mounted locally"
        );
      }
    }
    if (_protocols.includes(Protocols.Store)) {
      if (this.store) {
        codecs.push(this.store.multicodec);
      } else {
        log(
          "Store codec not included in dial codec: protocol not mounted locally"
        );
      }
    }
    if (_protocols.includes(Protocols.LightPush)) {
      if (this.lightPush) {
        codecs.push(this.lightPush.multicodec);
      } else {
        log(
          "Light Push codec not included in dial codec: protocol not mounted locally"
        );
      }
    }
    if (_protocols.includes(Protocols.Filter)) {
      if (this.filter) {
        codecs.push(this.filter.multicodec);
      } else {
        log(
          "Filter codec not included in dial codec: protocol not mounted locally"
        );
      }
    }

    log(`Dialing to ${peerId.toString()} with protocols ${_protocols}`);

    return this.libp2p.dialProtocol(peerId, codecs);
  }

  async start(): Promise<void> {
    await this.libp2p.start();
  }

  async stop(): Promise<void> {
    this.connectionManager.stop();
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
function mapToPeerIdOrMultiaddr(
  peerId: PeerId | MultiaddrInput
): PeerId | Multiaddr {
  return isPeerId(peerId) ? peerId : multiaddr(peerId);
}

import type { Stream } from "@libp2p/interface-connection";
import type { Libp2p } from "@libp2p/interface-libp2p";
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
import debug from "debug";

import { createEncoder } from "./message/version_0.js";
import * as relayConstants from "./relay/constants.js";
import { RelayPingContentTopic } from "./relay/constants.js";

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
  public peerExchange?: IPeerExchange;

  private pingKeepAliveTimers: {
    [peer: string]: ReturnType<typeof setInterval>;
  };
  private relayKeepAliveTimers: {
    [peer: string]: ReturnType<typeof setInterval>;
  };

  constructor(
    options: WakuOptions,
    libp2p: Libp2p,
    store?: (libp2p: Libp2p) => IStore,
    lightPush?: (libp2p: Libp2p) => ILightPush,
    filter?: (libp2p: Libp2p) => IFilter,
    peerExchange?: (components: PeerExchangeComponents) => IPeerExchange
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

    if (peerExchange) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore: Libp2p is now hiding internal components but peer discovery
      // implementation still expect to receive said components.
      this.peerExchange = peerExchange(libp2p.components);
    }

    if (isRelay(libp2p.pubsub)) {
      this.relay = libp2p.pubsub;
    }

    log(
      "Waku node created",
      this.libp2p.peerId.toString(),
      `relay: ${!!this.relay}, store: ${!!this.store}, light push: ${!!this
        .lightPush}, filter: ${!!this.filter}, peer exchange: ${!!this
        .peerExchange} `
    );

    this.pingKeepAliveTimers = {};
    this.relayKeepAliveTimers = {};

    const pingKeepAlive =
      options.pingKeepAlive || DefaultPingKeepAliveValueSecs;
    const relayKeepAlive = this.relay
      ? options.relayKeepAlive || DefaultRelayKeepAliveValueSecs
      : 0;

    libp2p.addEventListener("peer:connect", (evt) => {
      this.startKeepAlive(evt.detail.remotePeer, pingKeepAlive, relayKeepAlive);
    });

    /**
     * NOTE: Event is not being emitted on closing nor losing a connection.
     * @see https://github.com/libp2p/js-libp2p/issues/939
     * @see https://github.com/status-im/js-waku/issues/252
     *
     * >This event will be triggered anytime we are disconnected from another peer,
     * >regardless of the circumstances of that disconnection.
     * >If we happen to have multiple connections to a peer,
     * >this event will **only** be triggered when the last connection is closed.
     * @see https://github.com/libp2p/js-libp2p/blob/bad9e8c0ff58d60a78314077720c82ae331cc55b/doc/API.md?plain=1#L2100
     */
    libp2p.addEventListener("peer:disconnect", (evt) => {
      this.stopKeepAlive(evt.detail.remotePeer);
    });

    // Trivial handling of discovered peers, to be refined.
    libp2p.addEventListener("peer:discovery", (evt) => {
      const peerId = evt.detail.id;
      log(`Found peer ${peerId.toString()}, dialing.`);
      libp2p.dial(peerId).catch((err) => {
        log(`Fail to dial ${peerId}`, err);
      });
    });
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
      if (this.relay) {
        this.relay.multicodecs.forEach((codec) => codecs.push(codec));
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

    if (_protocols.includes(Protocols.PeerExchange)) {
      if (this.peerExchange) {
        codecs.push(this.peerExchange.multicodec);
      } else {
        log(
          "Peer Exchange codec not included in dial codec: protocol not mounted locally"
        );
      }
    }

    log(`Dialing to ${peer.toString()} with protocols ${_protocols}`);

    return this.libp2p.dialProtocol(peer, codecs);
  }

  async start(): Promise<void> {
    await this.libp2p.start();
  }

  async stop(): Promise<void> {
    this.stopAllKeepAlives();
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

  private startKeepAlive(
    peerId: PeerId,
    pingPeriodSecs: number,
    relayPeriodSecs: number
  ): void {
    // Just in case a timer already exist for this peer
    this.stopKeepAlive(peerId);

    const peerIdStr = peerId.toString();

    if (pingPeriodSecs !== 0) {
      this.pingKeepAliveTimers[peerIdStr] = setInterval(() => {
        this.libp2p.ping(peerId).catch((e) => {
          log(`Ping failed (${peerIdStr})`, e);
        });
      }, pingPeriodSecs * 1000);
    }

    const relay = this.relay;
    if (relay && relayPeriodSecs !== 0) {
      const encoder = createEncoder({
        contentTopic: RelayPingContentTopic,
        ephemeral: true,
      });
      this.relayKeepAliveTimers[peerIdStr] = setInterval(() => {
        log("Sending Waku Relay ping message");
        relay
          .send(encoder, { payload: new Uint8Array() })
          .catch((e) => log("Failed to send relay ping", e));
      }, relayPeriodSecs * 1000);
    }
  }

  private stopKeepAlive(peerId: PeerId): void {
    const peerIdStr = peerId.toString();

    if (this.pingKeepAliveTimers[peerIdStr]) {
      clearInterval(this.pingKeepAliveTimers[peerIdStr]);
      delete this.pingKeepAliveTimers[peerIdStr];
    }

    if (this.relayKeepAliveTimers[peerIdStr]) {
      clearInterval(this.relayKeepAliveTimers[peerIdStr]);
      delete this.relayKeepAliveTimers[peerIdStr];
    }
  }

  private stopAllKeepAlives(): void {
    for (const timer of [
      ...Object.values(this.pingKeepAliveTimers),
      ...Object.values(this.relayKeepAliveTimers),
    ]) {
      clearInterval(timer);
    }

    this.pingKeepAliveTimers = {};
    this.relayKeepAliveTimers = {};
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

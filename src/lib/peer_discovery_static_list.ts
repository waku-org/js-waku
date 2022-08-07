import type {
  PeerDiscovery,
  PeerDiscoveryEvents,
} from "@libp2p/interface-peer-discovery";
import { symbol } from "@libp2p/interface-peer-discovery";
import type { PeerInfo } from "@libp2p/interface-peer-info";
import { CustomEvent, EventEmitter } from "@libp2p/interfaces/events";
import { Multiaddr } from "@multiformats/multiaddr";
import debug from "debug";

import { multiaddrsToPeerInfo } from "./multiaddr_to_peer_info";
import { getPseudoRandomSubset } from "./random_subset";

const log = debug("waku:peer-discovery-static-list");

export interface Options {
  /**
   * The maximum of peers to connect to as part of the bootstrap process.
   *
   * @default The length of the passed `peers` array.
   */
  maxPeers?: number;
  /**
   * The interval between emitting addresses in milliseconds.
   *
   * @default {@link PeerDiscoveryEvents.DefaultInterval}
   */
  interval?: number;
}

/**
 * Parse options and expose function to return bootstrap peer addresses.
 *
 * @throws if an invalid combination of options is passed, see [[BootstrapOptions]] for details.
 */
export class PeerDiscoveryStaticPeers
  extends EventEmitter<PeerDiscoveryEvents>
  implements PeerDiscovery
{
  static DefaultInterval = 200;
  private readonly peers: PeerInfo[];
  private timer?: ReturnType<typeof setInterval>;
  private readonly interval: number;

  /**
   * @param peers Multiaddrs of peers to connect to.
   * @param opts
   */
  constructor(peers: string[] | Multiaddr[], opts?: Options) {
    super();

    this.interval = opts?.interval ?? PeerDiscoveryStaticPeers.DefaultInterval;
    const maxPeers = opts?.maxPeers ?? peers?.length;

    const peerMas = peers.map((peer: string | Multiaddr) => {
      if (typeof peer === "string") {
        return new Multiaddr(peer);
      } else {
        return peer;
      }
    });
    this.peers = multiaddrsToPeerInfo(getPseudoRandomSubset(peerMas, maxPeers));
    log(
      "Use provided list of peers (reduced to maxPeers)",
      this.peers.map((ma) => ma.toString())
    );
  }

  /**
   * Start emitting static peers.
   */
  start(): void {
    this._startTimer();
  }

  private _startTimer(): void {
    if (this.peers) {
      log("Starting to emit static peers.");
      if (this.timer != null) {
        return;
      }

      this.timer = setInterval(() => this._returnPeers(), this.interval);

      this._returnPeers();
    }
  }

  _returnPeers(): void {
    if (this.timer == null) {
      return;
    }

    this.peers.forEach((peerData) => {
      this.dispatchEvent(
        new CustomEvent<PeerInfo>("peer", { detail: peerData })
      );
    });
  }

  /**
   * Stop emitting peers.
   */
  stop(): void {
    if (this.timer != null) {
      clearInterval(this.timer);
    }

    this.timer = undefined;
  }

  get [symbol](): true {
    return true;
  }

  get [Symbol.toStringTag](): string {
    return "@waku/peer-discovery-static-list";
  }
}

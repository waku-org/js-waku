import type {
  PeerDiscovery,
  PeerDiscoveryEvents,
} from "@libp2p/interface-peer-discovery";
import { symbol } from "@libp2p/interface-peer-discovery";
import type { PeerInfo } from "@libp2p/interface-peer-info";
import { CustomEvent, EventEmitter } from "@libp2p/interfaces/events";
import { peerIdFromString } from "@libp2p/peer-id/src";
import { Multiaddr } from "@multiformats/multiaddr";
import debug from "debug";

import { DnsNodeDiscovery, NodeCapabilityCount } from "./dns";
import { getPredefinedBootstrapNodes } from "./predefined";
import { getPseudoRandomSubset } from "./random_subset";

const log = debug("waku:discovery:bootstrap");

/**
 * Setup discovery method used to bootstrap.
 *
 * Only one method is used. [[default]], [[peers]], [[getPeers]] and [[enrUrl]] options are mutually exclusive.
 */
export interface BootstrapOptions {
  /**
   * The maximum of peers to connect to as part of the bootstrap process.
   * This only applies if [[peers]] or [[getPeers]] is used.
   *
   * @default [[Bootstrap.DefaultMaxPeers]]
   */
  maxPeers?: number;
  /**
   * Use the default discovery method. Overrides all other options but `maxPeers`
   *
   * The default discovery method is likely to change overtime as new discovery
   * methods are implemented.
   *
   * @default false
   */
  default?: boolean;
  /**
   * Multiaddrs of peers to connect to.
   */
  peers?: string[] | Multiaddr[];
  /**
   * Getter that retrieve multiaddrs of peers to connect to.
   * will be called once.
   */
  getPeers?: () => Promise<string[] | Multiaddr[]>;
  /**
   * The interval between emitting addresses in milliseconds.
   * Used if [[peers]] is passed or a sync function is passed for [[getPeers]]
   */
  interval?: number;
  /**
   * An EIP-1459 ENR Tree URL. For example:
   * "enrtree://AOFTICU2XWDULNLZGRMQS4RIZPAZEHYMV4FYHAPW563HNRAOERP7C@test.nodes.vac.dev"
   *
   * [[wantedNodeCapabilityCount]] MUST be passed when using this option.
   */
  enrUrl?: string;
  /**
   * Specifies what node capabilities (protocol) must be returned.
   * This only applies when [[enrUrl]] is passed (EIP-1459 DNS Discovery).
   */
  wantedNodeCapabilityCount?: Partial<NodeCapabilityCount>;
}

/**
 * Parse options and expose function to return bootstrap peer addresses.
 *
 * @throws if an invalid combination of options is passed, see [[BootstrapOptions]] for details.
 */
export class Bootstrap
  extends EventEmitter<PeerDiscoveryEvents>
  implements PeerDiscovery
{
  static DefaultMaxPeers = 1;

  private readonly asyncGetBootstrapPeers:
    | (() => Promise<Multiaddr[]>)
    | undefined;
  private peers: PeerInfo[];
  private timer?: ReturnType<typeof setInterval>;
  private readonly interval: number;

  constructor(opts?: BootstrapOptions) {
    super();
    opts = opts ?? {};

    const methods = [
      !!opts.default,
      !!opts.peers,
      !!opts.getPeers,
      !!opts.enrUrl,
    ].filter((x) => x);
    if (methods.length > 1) {
      throw new Error(
        "Bootstrap does not support several discovery methods (yet)"
      );
    }

    this.interval = opts.interval ?? 10000;
    opts.default =
      opts.default ?? (!opts.peers && !opts.getPeers && !opts.enrUrl);
    const maxPeers = opts.maxPeers ?? Bootstrap.DefaultMaxPeers;
    this.peers = [];

    if (opts.default) {
      log("Use hosted list of peers.");

      this.peers = multiaddrsToPeerInfo(
        getPredefinedBootstrapNodes(undefined, maxPeers)
      );
      return;
    }

    if (!!opts.peers && opts.peers.length > 0) {
      const allPeers: Multiaddr[] = opts.peers.map(
        (node: string | Multiaddr) => {
          if (typeof node === "string") {
            return new Multiaddr(node);
          } else {
            return node;
          }
        }
      );
      this.peers = multiaddrsToPeerInfo(
        getPseudoRandomSubset(allPeers, maxPeers)
      );
      log(
        "Use provided list of peers (reduced to maxPeers)",
        this.peers.map((ma) => ma.toString())
      );
      return;
    }

    if (typeof opts.getPeers === "function") {
      log("Bootstrap: Use provided getPeers function.");
      const getPeers = opts.getPeers;

      this.asyncGetBootstrapPeers = async () => {
        const allPeers = await getPeers();
        return getPseudoRandomSubset<string | Multiaddr>(
          allPeers,
          maxPeers
        ).map((node) => new Multiaddr(node));
      };
      return;
    }

    if (opts.enrUrl) {
      const wantedNodeCapabilityCount = opts.wantedNodeCapabilityCount;
      if (!wantedNodeCapabilityCount)
        throw "`wantedNodeCapabilityCount` must be defined when using `enrUrl`";
      const enrUrl = opts.enrUrl;
      log("Use provided EIP-1459 ENR Tree URL.");

      const dns = DnsNodeDiscovery.dnsOverHttp();

      this.asyncGetBootstrapPeers = async () => {
        const enrs = await dns.getPeers([enrUrl], wantedNodeCapabilityCount);
        log(`Found ${enrs.length} peers`);
        return enrs.map((enr) => enr.getFullMultiaddrs()).flat();
      };

      return;
    }
  }

  /**
   * Start discovery process
   */
  start(): void {
    if (this.asyncGetBootstrapPeers) {
      // TODO: This should emit the peer as they are discovered instead of having
      // to wait for the full DNS discovery process to be done first.
      // TODO: PeerInfo should be returned by discovery
      this.asyncGetBootstrapPeers().then((peers) => {
        this.peers = multiaddrsToPeerInfo(peers);
        this._startTimer();
      });
    } else {
      this._startTimer();
    }
  }

  private _startTimer(): void {
    if (this.peers) {
      log("Starting bootstrap node discovery");
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
   * Stop emitting events
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
    return "@waku/bootstrap";
  }
}

function multiaddrsToPeerInfo(mas: Multiaddr[]): PeerInfo[] {
  return mas
    .map((ma) => {
      const peerIdStr = ma.getPeerId();
      const protocols: string[] = [];
      return {
        id: peerIdStr ? peerIdFromString(peerIdStr) : null,
        multiaddrs: [ma.decapsulateCode(421)],
        protocols,
      };
    })
    .filter((peerInfo): peerInfo is PeerInfo => peerInfo.id !== null);
}

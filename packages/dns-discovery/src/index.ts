import type {
  PeerDiscovery,
  PeerDiscoveryEvents,
} from "@libp2p/interface-peer-discovery";
import { symbol } from "@libp2p/interface-peer-discovery";
import type { PeerInfo } from "@libp2p/interface-peer-info";
import type { PeerStore } from "@libp2p/interface-peer-store";
import { CustomEvent, EventEmitter } from "@libp2p/interfaces/events";
import type { IEnr } from "@waku/interfaces";
import debug from "debug";

import { DnsNodeDiscovery, NodeCapabilityCount } from "./dns.js";

export { NodeCapabilityCount };

const log = debug("waku:peer-discovery-dns");

const enrTree = {
  TEST: "enrtree://AOGECG2SPND25EEFMAJ5WF3KSGJNSGV356DSTL2YVLLZWIV6SAYBM@test.waku.nodes.status.im",
  PROD: "enrtree://AOGECG2SPND25EEFMAJ5WF3KSGJNSGV356DSTL2YVLLZWIV6SAYBM@prod.waku.nodes.status.im",
};

const DEFAULT_BOOTSTRAP_TAG_NAME = "bootstrap";
const DEFAULT_BOOTSTRAP_TAG_VALUE = 50;
const DEFAULT_BOOTSTRAP_TAG_TTL = 120000;

export interface DnsDiscoveryComponents {
  peerStore: PeerStore;
}

export interface Options {
  /**
   * ENR URL to use for DNS discovery
   */
  enrUrl: string;
  /**
   * Specifies what type of nodes are wanted from the discovery process
   */
  wantedNodeCapabilityCount: Partial<NodeCapabilityCount>;
  /**
   * Tag a bootstrap peer with this name before "discovering" it (default: 'bootstrap')
   */
  tagName?: string;

  /**
   * The bootstrap peer tag will have this value (default: 50)
   */
  tagValue?: number;

  /**
   * Cause the bootstrap peer tag to be removed after this number of ms (default: 2 minutes)
   */
  tagTTL?: number;
}

/**
 * Parse options and expose function to return bootstrap peer addresses.
 */
export class PeerDiscoveryDns
  extends EventEmitter<PeerDiscoveryEvents>
  implements PeerDiscovery
{
  private nextPeer: (() => AsyncGenerator<IEnr>) | undefined;
  private _started: boolean;
  private _components: DnsDiscoveryComponents;
  private _options: Options;

  constructor(components: DnsDiscoveryComponents, options: Options) {
    super();
    this._started = false;
    this._components = components;
    this._options = options;

    const { enrUrl } = options;
    log("Use following EIP-1459 ENR Tree URL: ", enrUrl);
  }

  /**
   * Start discovery process
   */
  async start(): Promise<void> {
    log("Starting peer discovery via dns");

    this._started = true;

    if (this.nextPeer === undefined) {
      const { enrUrl, wantedNodeCapabilityCount } = this._options;
      const dns = await DnsNodeDiscovery.dnsOverHttp();

      this.nextPeer = dns.getNextPeer.bind(
        dns,
        [enrUrl],
        wantedNodeCapabilityCount
      );
    }

    for await (const peer of this.nextPeer()) {
      if (!this._started) return;

      const peerInfo = peer.peerInfo;
      if (!peerInfo) continue;

      if (
        (await this._components.peerStore.getTags(peerInfo.id)).find(
          ({ name }) => name === DEFAULT_BOOTSTRAP_TAG_NAME
        )
      )
        continue;

      await this._components.peerStore.tagPeer(
        peerInfo.id,
        DEFAULT_BOOTSTRAP_TAG_NAME,
        {
          value: this._options.tagValue ?? DEFAULT_BOOTSTRAP_TAG_VALUE,
          ttl: this._options.tagTTL ?? DEFAULT_BOOTSTRAP_TAG_TTL,
        }
      );
      this.dispatchEvent(
        new CustomEvent<PeerInfo>("peer", { detail: peerInfo })
      );
    }
  }

  /**
   * Stop emitting events
   */
  stop(): void {
    this._started = false;
  }

  get [symbol](): true {
    return true;
  }

  get [Symbol.toStringTag](): string {
    return "@waku/bootstrap";
  }
}

export function wakuDnsDiscovery(
  enrUrl: string,
  wantedNodeCapabilityCount: Partial<NodeCapabilityCount>
): (components: DnsDiscoveryComponents) => PeerDiscoveryDns {
  return (components: DnsDiscoveryComponents) =>
    new PeerDiscoveryDns(components, { enrUrl, wantedNodeCapabilityCount });
}

export { DnsNodeDiscovery, SearchContext, DnsClient } from "./dns.js";

export { enrTree };

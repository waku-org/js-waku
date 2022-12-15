import type {
  PeerDiscovery,
  PeerDiscoveryEvents,
} from "@libp2p/interface-peer-discovery";
import { symbol } from "@libp2p/interface-peer-discovery";
import type { PeerInfo } from "@libp2p/interface-peer-info";
import { CustomEvent, EventEmitter } from "@libp2p/interfaces/events";
import { ENR } from "@waku/enr";
import { multiaddrsToPeerInfo } from "@waku/libp2p-utils";
import debug from "debug";

import { DnsNodeDiscovery, NodeCapabilityCount } from "./dns.js";

const log = debug("waku:peer-discovery-dns");

/**
 * Parse options and expose function to return bootstrap peer addresses.
 *
 * @throws if an invalid combination of options is passed, see [[BootstrapOptions]] for details.
 */
export class PeerDiscoveryDns
  extends EventEmitter<PeerDiscoveryEvents>
  implements PeerDiscovery
{
  private readonly nextPeer: () => AsyncGenerator<ENR>;
  private _started: boolean;

  /**
   * @param enrUrl An EIP-1459 ENR Tree URL. For example:
   * "enrtree://AOFTICU2XWDULNLZGRMQS4RIZPAZEHYMV4FYHAPW563HNRAOERP7C@test.nodes.vac.dev"
   * @param wantedNodeCapabilityCount Specifies what node capabilities
   * (protocol) must be returned.
   */
  constructor(
    enrUrl: string,
    wantedNodeCapabilityCount: Partial<NodeCapabilityCount>
  ) {
    super();
    this._started = false;
    log("Use following EIP-1459 ENR Tree URL: ", enrUrl);

    const dns = DnsNodeDiscovery.dnsOverHttp();

    this.nextPeer = dns.getNextPeer.bind(
      {},
      [enrUrl],
      wantedNodeCapabilityCount
    );
  }

  /**
   * Start discovery process
   */
  async start(): Promise<void> {
    log("Starting peer discovery via dns");

    this._started = true;
    for await (const peer of this.nextPeer()) {
      if (!this._started) return;
      const peerInfos = multiaddrsToPeerInfo(peer.getFullMultiaddrs());
      peerInfos.forEach((peerInfo) => {
        this.dispatchEvent(
          new CustomEvent<PeerInfo>("peer", { detail: peerInfo })
        );
      });
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
): () => PeerDiscoveryDns {
  return () => new PeerDiscoveryDns(enrUrl, wantedNodeCapabilityCount);
}

export { DnsNodeDiscovery } from "./dns.js";

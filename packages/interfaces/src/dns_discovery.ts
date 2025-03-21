import { PeerStore } from "@libp2p/interface";

export const DNS_DISCOVERY_TAG = "@waku/bootstrap";

export type SearchContext = {
  domain: string;
  publicKey: string;
  visits: { [key: string]: boolean };
};

export interface DnsClient {
  resolveTXT: (domain: string) => Promise<string[]>;
}

export interface DnsDiscoveryComponents {
  peerStore: PeerStore;
}

export interface DnsDiscOptions {
  /**
   * ENR URL to use for DNS discovery
   */
  enrUrls: string | string[];

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

export interface DiscoveryTrigger {
  findPeers: () => Promise<void>;
}

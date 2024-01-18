import { PeerStore } from "@libp2p/interface";

export type SearchContext = {
  domain: string;
  publicKey: string;
  visits: { [key: string]: boolean };
};

export interface DnsClient {
  resolveTXT: (domain: string) => Promise<string[]>;
}

export interface NodeCapabilityCount {
  relay: number;
  store: number;
  filter: number;
  lightPush: number;
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

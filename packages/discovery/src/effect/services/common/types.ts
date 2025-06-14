import type { PeerId, PeerInfo } from "@libp2p/interface";
import type { IEnr, NodeCapabilityCount, ShardInfo } from "@waku/interfaces";
import type { Effect, Stream } from "effect";

import type { DiscoveryError } from "./errors.js";

/**
 * Discovered peer with metadata
 */
export interface DiscoveredPeer {
  readonly peerInfo: PeerInfo;
  readonly enr?: IEnr;
  readonly shardInfo?: ShardInfo;
  readonly discoveredAt: Date;
  readonly source: DiscoverySource;
}

/**
 * Source of peer discovery
 */
export type DiscoverySource =
  | { readonly _tag: "dns"; readonly domain: string }
  | { readonly _tag: "peer-exchange"; readonly fromPeer: PeerId }
  | { readonly _tag: "cache"; readonly key: string };

/**
 * DNS discovery configuration
 */
export interface DnsDiscoveryConfig {
  readonly enrUrls: string[];
  readonly wantedNodeCapabilityCount: Partial<NodeCapabilityCount>;
  readonly tagName?: string;
  readonly tagValue?: number;
  readonly tagTTL?: number;
}

/**
 * Peer exchange configuration
 */
export interface PeerExchangeConfig {
  readonly numPeersToRequest: number;
  readonly queryInterval: number;
  readonly maxRetries: number;
  readonly tagName?: string;
  readonly tagValue?: number;
  readonly tagTTL?: number;
}

/**
 * Local cache configuration
 */
export interface LocalCacheConfig {
  readonly maxSize: number;
  readonly maxPeers?: number;
  readonly ttl: number;
  readonly storageKey?: string;
}

/**
 * Common discovery service interface
 */
export interface DiscoveryService {
  readonly discover: () => Stream.Stream<DiscoveredPeer, DiscoveryError>;
  readonly stop: () => Effect.Effect<void>;
}

/**
 * DNS-specific discovery service
 */
export interface DnsDiscoveryService extends DiscoveryService {
  readonly discoverFromUrl: (
    enrUrl: string
  ) => Effect.Effect<readonly DiscoveredPeer[], DiscoveryError>;

  readonly filterPeers: (
    peers: readonly IEnr[],
    requirements: Partial<NodeCapabilityCount>
  ) => Effect.Effect<readonly IEnr[]>;
}

/**
 * Peer exchange service
 */
export interface PeerExchangeService extends DiscoveryService {
  readonly queryPeer: (
    peerId: PeerId,
    numPeers: number
  ) => Effect.Effect<readonly DiscoveredPeer[], DiscoveryError>;
}

/**
 * Cache service
 */
export interface CacheService {
  readonly get: (
    key: string
  ) => Effect.Effect<DiscoveredPeer | null, DiscoveryError>;
  readonly set: (
    key: string,
    peer: DiscoveredPeer
  ) => Effect.Effect<void, DiscoveryError>;
  readonly delete: (key: string) => Effect.Effect<void, DiscoveryError>;
  readonly clear: () => Effect.Effect<void, DiscoveryError>;
  readonly getAll: () => Effect.Effect<
    readonly DiscoveredPeer[],
    DiscoveryError
  >;
}

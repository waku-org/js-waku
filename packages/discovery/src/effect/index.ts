/**
 * Effect-based discovery implementations for js-waku
 *
 * These implementations use Effect internally while maintaining
 * full compatibility with libp2p interfaces.
 */

// DNS Discovery
export {
  PeerDiscoveryDnsEffect,
  wakuDnsDiscovery as wakuDnsDiscoveryEffect
} from "./wrappers/dns-discovery-wrapper.js";

// Peer Exchange Discovery
export {
  PeerExchangeDiscoveryEffect,
  wakuPeerExchangeDiscovery as wakuPeerExchangeDiscoveryEffect
} from "./wrappers/peer-exchange-wrapper.js";

// Local Cache Discovery
export {
  LocalPeerCacheDiscoveryEffect,
  wakuLocalPeerCacheDiscovery as wakuLocalPeerCacheDiscoveryEffect
} from "./wrappers/cache-discovery-wrapper.js";

// Common types and errors
export type {
  DiscoveredPeer,
  DiscoverySource,
  DnsDiscoveryConfig,
  PeerExchangeConfig,
  LocalCacheConfig,
  DiscoveryService
} from "./services/common/types.js";

export {
  DnsResolutionError,
  EnrParsingError,
  PeerExchangeError,
  NetworkTimeoutError,
  InvalidPeerError,
  CacheError,
  ProtocolError,
  type DiscoveryError
} from "./services/common/errors.js";

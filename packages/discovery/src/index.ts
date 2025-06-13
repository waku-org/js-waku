// Load polyfills
import "./polyfills.js";

// DNS Discovery - Effect implementations as primary
export {
  PeerDiscoveryDnsEffect as PeerDiscoveryDns,
  wakuDnsDiscovery
} from "./effect/wrappers/dns-discovery-wrapper.js";

// Also export Effect versions with "Effect" suffix for SDK compatibility
export {
  PeerDiscoveryDnsEffect,
  wakuDnsDiscovery as wakuDnsDiscoveryEffect
} from "./effect/wrappers/dns-discovery-wrapper.js";

// Keep constants and low-level DNS class for backward compatibility with tests
export { enrTree } from "./dns/constants.js";
export { DnsNodeDiscovery } from "./dns/dns.js";

// Peer Exchange Discovery - Effect implementations as primary
export {
  PeerExchangeDiscoveryEffect as PeerExchangeDiscovery,
  wakuPeerExchangeDiscovery
} from "./effect/wrappers/peer-exchange-wrapper.js";

// Also export Effect versions with "Effect" suffix for SDK compatibility
export {
  PeerExchangeDiscoveryEffect,
  wakuPeerExchangeDiscovery as wakuPeerExchangeDiscoveryEffect
} from "./effect/wrappers/peer-exchange-wrapper.js";

// Keep protocol-level exports for tests and direct protocol usage
export {
  wakuPeerExchange,
  PeerExchangeCodec,
  WakuPeerExchange
} from "./peer-exchange/waku_peer_exchange.js";

// Local Peer Cache Discovery - Effect implementation as primary
export {
  LocalPeerCacheDiscoveryEffect as LocalPeerCacheDiscovery,
  wakuLocalPeerCacheDiscovery
} from "./effect/wrappers/cache-discovery-wrapper.js";

// Also export Effect versions with "Effect" suffix for SDK compatibility
export {
  LocalPeerCacheDiscoveryEffect,
  wakuLocalPeerCacheDiscovery as wakuLocalPeerCacheDiscoveryEffect
} from "./effect/wrappers/cache-discovery-wrapper.js";

// Export all Effect types
export type {
  DiscoveredPeer,
  DiscoverySource,
  DnsDiscoveryConfig,
  PeerExchangeConfig,
  LocalCacheConfig,
  DiscoveryService,
  DiscoveryError
} from "./effect/index.js";

// Export Effect errors
export {
  DnsResolutionError,
  EnrParsingError,
  PeerExchangeError,
  NetworkTimeoutError,
  InvalidPeerError,
  CacheError,
  ProtocolError
} from "./effect/index.js";

// Export test helpers (only for testing)
export { createImmediatePeerDnsClient } from "./effect/test-helpers/mock-dns-client.js";

// Load polyfills
import "./polyfills.js";

// DNS Discovery
export { PeerDiscoveryDns, wakuDnsDiscovery } from "./dns/dns_discovery.js";
export { enrTree } from "./dns/constants.js";
export { DnsNodeDiscovery } from "./dns/dns.js";

// Peer Exchange Discovery
export {
  wakuPeerExchange,
  PeerExchangeCodec,
  WakuPeerExchange
} from "./peer-exchange/waku_peer_exchange.js";
export {
  wakuPeerExchangeDiscovery,
  PeerExchangeDiscovery
} from "./peer-exchange/waku_peer_exchange_discovery.js";

// Local Peer Cache Discovery
export {
  LocalPeerCacheDiscovery,
  wakuLocalPeerCacheDiscovery
} from "./local-peer-cache/index.js";

// Effect-based implementations (opt-in)
export {
  PeerDiscoveryDnsEffect,
  wakuDnsDiscoveryEffect,
  PeerExchangeDiscoveryEffect,
  wakuPeerExchangeDiscoveryEffect,
  LocalPeerCacheDiscoveryEffect,
  wakuLocalPeerCacheDiscoveryEffect
} from "./effect/index.js";

// Re-export Effect types for consumers
export type {
  DiscoveredPeer,
  DiscoverySource,
  DnsDiscoveryConfig as EffectDnsDiscoveryConfig,
  PeerExchangeConfig as EffectPeerExchangeConfig,
  LocalCacheConfig as EffectLocalCacheConfig,
  DiscoveryError
} from "./effect/index.js";

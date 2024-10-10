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

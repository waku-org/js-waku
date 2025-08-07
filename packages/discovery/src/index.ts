// DNS Discovery
export { PeerDiscoveryDns, wakuDnsDiscovery } from "./dns/dns_discovery.js";
export { enrTree } from "./dns/constants.js";
export { DnsNodeDiscovery } from "./dns/dns.js";

// Peer Exchange Discovery
export {
  wakuPeerExchangeDiscovery,
  PeerExchangeDiscovery,
  PeerExchangeCodec
} from "./peer-exchange/index.js";

// Local Peer Cache Discovery
export {
  LocalPeerCacheDiscovery,
  wakuLocalPeerCacheDiscovery
} from "./local-peer-cache/index.js";

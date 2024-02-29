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
  PeerExchangeDiscovery,
  Options,
  DEFAULT_PEER_EXCHANGE_TAG_NAME
} from "./peer-exchange/waku_peer_exchange_discovery.js";

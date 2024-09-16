import type { PeerDiscovery } from "@libp2p/interface";
import {
  enrTree,
  wakuDnsDiscovery,
  wakuLocalPeerCacheDiscovery,
  wakuPeerExchangeDiscovery
} from "@waku/discovery";
import { type Libp2pComponents, PubsubTopic } from "@waku/interfaces";

export function defaultPeerDiscoveries(
  pubsubTopics: PubsubTopic[]
): ((components: Libp2pComponents) => PeerDiscovery)[] {
  const dnsEnrTrees = [enrTree["TEST"]];

  const discoveries = [
    wakuDnsDiscovery(dnsEnrTrees),
    wakuLocalPeerCacheDiscovery(),
    wakuPeerExchangeDiscovery(pubsubTopics)
  ];

  return discoveries;
}

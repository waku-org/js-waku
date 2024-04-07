import type { PeerDiscovery } from "@libp2p/interface";
import { enrTree, wakuDnsDiscovery } from "@waku/discovery";
import { wakuLocalPeerCacheDiscovery } from "@waku/discovery";
import { wakuPeerExchangeDiscovery } from "@waku/discovery";
import { type Libp2pComponents, PubsubTopic } from "@waku/interfaces";

const DEFAULT_NODE_REQUIREMENTS = {
  lightPush: 1,
  filter: 1,
  store: 1
};

export function defaultPeerDiscoveries(
  pubsubTopics: PubsubTopic[]
): ((components: Libp2pComponents) => PeerDiscovery)[] {
  const discoveries = [
    wakuDnsDiscovery([enrTree["PROD"]], DEFAULT_NODE_REQUIREMENTS),
    wakuLocalPeerCacheDiscovery(),
    wakuPeerExchangeDiscovery(pubsubTopics)
  ];
  return discoveries;
}

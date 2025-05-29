import type { PeerDiscovery } from "@libp2p/interface";
import {
  enrTree,
  wakuDnsDiscovery,
  wakuLocalPeerCacheDiscovery,
  wakuPeerExchangeDiscovery
} from "@waku/discovery";
import {
  CreateNodeOptions,
  type Libp2pComponents,
  PubsubTopic
} from "@waku/interfaces";

const DEFAULT_DISCOVERIES_ENABLED = {
  dns: true,
  peerExchange: true,
  localPeerCache: true
};

export function defaultPeerDiscoveries(
  pubsubTopics: PubsubTopic[],
  enabled: CreateNodeOptions["discovery"] = DEFAULT_DISCOVERIES_ENABLED
): ((components: Libp2pComponents) => PeerDiscovery)[] {
  const dnsEnrTrees = [enrTree["SANDBOX"]];

  const discoveries: ((components: Libp2pComponents) => PeerDiscovery)[] = [];

  if (enabled.dns) {
    discoveries.push(wakuDnsDiscovery(dnsEnrTrees));
  }

  if (enabled.localPeerCache) {
    discoveries.push(wakuLocalPeerCacheDiscovery());
  }

  if (enabled.peerExchange) {
    discoveries.push(wakuPeerExchangeDiscovery(pubsubTopics));
  }

  return discoveries;
}

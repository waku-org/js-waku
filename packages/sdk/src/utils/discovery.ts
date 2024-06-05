import type { PeerDiscovery } from "@libp2p/interface";
import {
  enrTree,
  wakuDnsDiscovery,
  wakuLocalPeerCacheDiscovery,
  wakuPeerExchangeDiscovery
} from "@waku/discovery";
import {
  DefaultPubsubTopic,
  type Libp2pComponents,
  PubsubTopic
} from "@waku/interfaces";

const DEFAULT_NODE_REQUIREMENTS = {
  lightPush: 1,
  filter: 1,
  store: 1
};

export function defaultPeerDiscoveries(
  pubsubTopics: PubsubTopic[]
): ((components: Libp2pComponents) => PeerDiscovery)[] {
  const discoveries = [];
  discoveries.push(
    wakuLocalPeerCacheDiscovery(),
    wakuPeerExchangeDiscovery(pubsubTopics)
  );

  //TODO: Add support for The Waku Network
  //https://github.com/waku-org/nwaku/issues/2593
  const isDefaultPubsub = pubsubTopics.includes(DefaultPubsubTopic);
  if (isDefaultPubsub) {
    discoveries.push(
      wakuDnsDiscovery([enrTree["DEPRECATED_DEFAULT_PUBSUB"]], DEFAULT_NODE_REQUIREMENTS)
    );
  }

  return discoveries;
}


export function xdefaultPeerDiscoveries(
  pubsubTopics: PubsubTopic[]
): ((components: Libp2pComponents) => PeerDiscovery)[] {
  const isDefaultPubsubTopic = pubsubTopics.includes(DefaultPubsubTopic);

  const dnsEnrTree = isDefaultPubsubTopic ? enrTree["DEPRECATED_DEFAULT_PUBSUB"] : undefined;
}

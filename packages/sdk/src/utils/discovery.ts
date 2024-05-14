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
  // TODO: add a check to see if it is indeed TWN or if it is a custom network
  const dnsFleet = pubsubTopics.includes(DefaultPubsubTopic)
    ? enrTree["TEST"]
    : enrTree["SANDBOX"];

  const discoveries = [
    wakuDnsDiscovery([dnsFleet], DEFAULT_NODE_REQUIREMENTS),
    wakuLocalPeerCacheDiscovery(),
    wakuPeerExchangeDiscovery(pubsubTopics)
  ];
  return discoveries;
}

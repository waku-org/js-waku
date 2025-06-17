import type { PeerDiscovery } from "@libp2p/interface";
import {
  enrTree,
  wakuDnsDiscovery,
  wakuDnsDiscoveryEffect,
  wakuLocalPeerCacheDiscovery,
  wakuLocalPeerCacheDiscoveryEffect,
  wakuPeerExchangeDiscovery,
  wakuPeerExchangeDiscoveryEffect
} from "@waku/discovery";
import {
  CreateNodeOptions,
  type Libp2pComponents,
  PubsubTopic
} from "@waku/interfaces";

/**
 * Get peer discovery implementations based on configuration.
 *
 * By default, uses the original implementations for backward compatibility.
 * Set WAKU_USE_EFFECT_DISCOVERY=true to use Effect-based implementations.
 */
export function getPeerDiscoveries(
  pubsubTopics: PubsubTopic[],
  enabled?: CreateNodeOptions["discovery"]
): ((components: Libp2pComponents) => PeerDiscovery)[] {
  const dnsEnrTrees = [enrTree["SANDBOX"]];

  const discoveries: ((components: Libp2pComponents) => PeerDiscovery)[] = [];

  // Check if Effect-based discovery should be used
  const useEffect = process.env.WAKU_USE_EFFECT_DISCOVERY === "true";

  if (enabled?.dns) {
    discoveries.push(
      useEffect
        ? wakuDnsDiscoveryEffect(dnsEnrTrees)
        : wakuDnsDiscovery(dnsEnrTrees)
    );
  }

  if (enabled?.localPeerCache) {
    discoveries.push(
      useEffect
        ? wakuLocalPeerCacheDiscoveryEffect()
        : wakuLocalPeerCacheDiscovery()
    );
  }

  if (enabled?.peerExchange) {
    discoveries.push(
      useEffect
        ? wakuPeerExchangeDiscoveryEffect(pubsubTopics)
        : wakuPeerExchangeDiscovery(pubsubTopics)
    );
  }

  return discoveries;
}

/**
 * Get Effect-based peer discovery implementations.
 *
 * This function explicitly returns Effect-based implementations
 * for applications that want to opt-in to the new architecture.
 */
export function getPeerDiscoveriesWithEffect(
  pubsubTopics: PubsubTopic[],
  enabled?: CreateNodeOptions["discovery"]
): ((components: Libp2pComponents) => PeerDiscovery)[] {
  const dnsEnrTrees = [enrTree["SANDBOX"]];

  const discoveries: ((components: Libp2pComponents) => PeerDiscovery)[] = [];

  if (enabled?.dns) {
    discoveries.push(wakuDnsDiscoveryEffect(dnsEnrTrees));
  }

  if (enabled?.localPeerCache) {
    discoveries.push(wakuLocalPeerCacheDiscoveryEffect());
  }

  if (enabled?.peerExchange) {
    discoveries.push(wakuPeerExchangeDiscoveryEffect(pubsubTopics));
  }

  return discoveries;
}

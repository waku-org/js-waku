import type { PeerDiscovery } from "@libp2p/interface";
import type {
  DnsDiscoveryComponents,
  NodeCapabilityCount
} from "@waku/interfaces";

import { wakuDnsDiscoveryEffect } from "../effect/index.js";

import { DEFAULT_NODE_REQUIREMENTS } from "./constants.js";
import { wakuDnsDiscovery as wakuDnsDiscoveryPromise } from "./dns_discovery.js";

/**
 * Creates a DNS discovery instance with optional Effect support
 *
 * By default, uses the promise-based implementation for backward compatibility.
 * Set WAKU_USE_EFFECT_DISCOVERY=true to use the Effect-based implementation.
 *
 * @param enrUrls - ENR tree URLs for discovery
 * @param wantedNodeCapabilityCount - Required node capabilities
 * @returns Factory function for creating discovery instance
 */
export function wakuDnsDiscoveryWithEffect(
  enrUrls: string[],
  wantedNodeCapabilityCount: Partial<NodeCapabilityCount> = DEFAULT_NODE_REQUIREMENTS
): (components: DnsDiscoveryComponents) => PeerDiscovery {
  // Check for feature flag
  const useEffect = process.env.WAKU_USE_EFFECT_DISCOVERY === "true";

  if (useEffect) {
    // Using Effect-based implementation when WAKU_USE_EFFECT_DISCOVERY=true
    return wakuDnsDiscoveryEffect(enrUrls, wantedNodeCapabilityCount);
  }

  return wakuDnsDiscoveryPromise(enrUrls, wantedNodeCapabilityCount);
}

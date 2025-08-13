import type { PeerDiscovery } from "@libp2p/interface";
import {
  enrTree,
  wakuDnsDiscovery,
  wakuLocalPeerCacheDiscovery,
  wakuPeerExchangeDiscovery
} from "@waku/discovery";
import { CreateNodeOptions, type Libp2pComponents } from "@waku/interfaces";

export function getPeerDiscoveries(
  enabled?: CreateNodeOptions["discovery"],
  localPeerCache?: CreateNodeOptions["localPeerCache"]
): ((components: Libp2pComponents) => PeerDiscovery)[] {
  const dnsEnrTrees = [enrTree["SANDBOX"], enrTree["TEST"]];

  const discoveries: ((components: Libp2pComponents) => PeerDiscovery)[] = [];

  if (enabled?.dns) {
    discoveries.push(wakuDnsDiscovery(dnsEnrTrees));
  }

  if (enabled?.localPeerCache) {
    discoveries.push(wakuLocalPeerCacheDiscovery(localPeerCache));
  }

  if (enabled?.peerExchange) {
    discoveries.push(wakuPeerExchangeDiscovery());
  }

  return discoveries;
}

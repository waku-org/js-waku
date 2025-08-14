import type { PeerDiscovery } from "@libp2p/interface";
import {
  enrTree,
  wakuDnsDiscovery,
  wakuPeerCacheDiscovery,
  wakuPeerExchangeDiscovery
} from "@waku/discovery";
import { CreateNodeOptions, type Libp2pComponents } from "@waku/interfaces";

export function getPeerDiscoveries(
  enabled?: CreateNodeOptions["discovery"],
  peerCache?: CreateNodeOptions["peerCache"]
): ((components: Libp2pComponents) => PeerDiscovery)[] {
  const dnsEnrTrees = [enrTree["SANDBOX"], enrTree["TEST"]];

  const discoveries: ((components: Libp2pComponents) => PeerDiscovery)[] = [];

  if (enabled?.dns) {
    discoveries.push(wakuDnsDiscovery(dnsEnrTrees));
  }

  if (enabled?.peerCache || peerCache) {
    discoveries.push(wakuPeerCacheDiscovery({ cache: peerCache }));
  }

  if (enabled?.peerExchange) {
    discoveries.push(wakuPeerExchangeDiscovery());
  }

  return discoveries;
}

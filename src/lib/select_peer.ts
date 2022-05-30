import { Peer } from "@libp2p/interfaces/src/peer-store";
import { Libp2p } from "libp2p";

/**
 * Returns a pseudo-random peer that supports the given protocol.
 * Useful for protocols such as store and light push
 */
export async function selectRandomPeer(
  peers: Peer[]
): Promise<Peer | undefined> {
  if (peers.length === 0) return;

  const index = Math.round(Math.random() * (peers.length - 1));
  return peers[index];
}

/**
 * Returns the list of peers that supports the given protocol.
 */
export async function getPeersForProtocol(
  libp2p: Libp2p,
  protocols: string[]
): Promise<Peer[]> {
  const peers: Peer[] = [];
  await libp2p.peerStore.forEach((peer) => {
    for (let i = 0; i < protocols.length; i++) {
      if (peer.protocols.includes(protocols[i])) {
        peers.push(peer);
        break;
      }
    }
  });
  return peers;
}

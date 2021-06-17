import Libp2p from 'libp2p';
import { Peer } from 'libp2p/src/peer-store';

/**
 * Returns a pseudo-random peer that supports the given protocol.
 * Useful for protocols such as store and light push
 */
export function selectRandomPeer(
  libp2p: Libp2p,
  protocol: string
): Peer | undefined {
  const allPeers = Array.from(libp2p.peerStore.peers.values());
  const size = allPeers.length;
  const peers = allPeers.filter((peer) => peer.protocols.includes(protocol));
  if (peers.length === 0) return;
  const index = Math.round(Math.random() * (size - 1));
  return allPeers[index];
}

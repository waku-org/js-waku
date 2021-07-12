import Libp2p from 'libp2p';
import { Peer } from 'libp2p/src/peer-store';

/**
 * Returns a pseudo-random peer that supports the given protocol.
 * Useful for protocols such as store and light push
 */
export function selectRandomPeer(peers: Peer[]): Peer | undefined {
  if (peers.length === 0) return;

  const index = Math.round(Math.random() * (peers.length - 1));
  return peers[index];
}

/**
 * Returns the list of peers that supports the given protocol.
 */
export function getPeersForProtocol(libp2p: Libp2p, protocol: string): Peer[] {
  return Array.from(libp2p.peerStore.peers.values()).filter((peer) =>
    peer.protocols.includes(protocol)
  );
}

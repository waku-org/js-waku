import type { Connection } from "@libp2p/interface-connection";
import type { PeerId } from "@libp2p/interface-peer-id";
import type { Peer, PeerStore } from "@libp2p/interface-peer-store";
import debug from "debug";

const log = debug("waku:libp2p-utils");

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
export async function getPeersForProtocol(
  peerStore: PeerStore,
  protocols: string[]
): Promise<Peer[]> {
  const peers: Peer[] = [];
  await peerStore.forEach((peer) => {
    for (let i = 0; i < protocols.length; i++) {
      if (peer.protocols.includes(protocols[i])) {
        peers.push(peer);
        break;
      }
    }
  });
  return peers;
}

export async function selectPeerForProtocol(
  peerStore: PeerStore,
  protocols: string[],
  peerId?: PeerId
): Promise<{ peer: Peer; protocol: string }> {
  let peer;
  if (peerId) {
    peer = await peerStore.get(peerId);
    if (!peer) {
      throw new Error(
        `Failed to retrieve connection details for provided peer in peer store: ${peerId.toString()}`
      );
    }
  } else {
    const peers = await getPeersForProtocol(peerStore, protocols);
    peer = selectRandomPeer(peers);
    if (!peer) {
      throw new Error(
        `Failed to find known peer that registers protocols: ${protocols}`
      );
    }
  }

  let protocol;
  for (const codec of protocols) {
    if (peer.protocols.includes(codec)) {
      protocol = codec;
      // Do not break as we want to keep the last value
    }
  }
  log(`Using codec ${protocol}`);
  if (!protocol) {
    throw new Error(
      `Peer does not register required protocols (${peer.id.toString()}): ${protocols}`
    );
  }

  return { peer, protocol };
}

export function selectConnection(
  connections: Connection[]
): Connection | undefined {
  if (!connections.length) return;
  if (connections.length === 1) return connections[0];

  let latestConnection: Connection | undefined;

  connections.forEach((connection) => {
    if (connection.stat.status === "OPEN") {
      if (!latestConnection) {
        latestConnection = connection;
      } else if (
        connection.stat.timeline.open > latestConnection.stat.timeline.open
      ) {
        latestConnection = connection;
      }
    }
  });

  return latestConnection;
}

import type { Connection } from "@libp2p/interface/connection";
import type { PeerId } from "@libp2p/interface/peer-id";
import type { Peer, PeerStore } from "@libp2p/interface/peer-store";
import debug from "debug";

import { bytesToUtf8 } from "../bytes/index.js";

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
 * Returns the peer with the lowest latency.
 * @param peerStore - The Libp2p PeerStore
 * @param peers - The list of peers to choose from
 * @returns The peer with the lowest latency, or undefined if no peer could be reached
 */
export async function selectLowestLatencyPeer(
  peerStore: PeerStore,
  peers: Peer[]
): Promise<Peer | undefined> {
  if (peers.length === 0) return;

  const results = await Promise.all(
    peers.map(async (peer) => {
      const pingBytes = (await peerStore.get(peer.id)).metadata.get("ping");
      if (!pingBytes) return { peer, ping: Infinity };

      const ping = Number(bytesToUtf8(pingBytes)) ?? Infinity;
      return { peer, ping };
    })
  );

  const lowestLatencyResult = results.sort((a, b) => a.ping - b.ping)[0];
  if (!lowestLatencyResult) {
    return undefined;
  }

  return lowestLatencyResult.ping !== Infinity
    ? lowestLatencyResult.peer
    : undefined;
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

/**
 * Returns a peer that supports the given protocol.
 * If peerId is provided, the peer with that id is returned.
 * Otherwise, the peer with the lowest latency is returned.
 * If no peer is found from the above criteria, a random peer is returned.
 */
export async function selectPeerForProtocol(
  peerStore: PeerStore,
  protocols: string[],
  peerId?: PeerId
): Promise<{ peer: Peer; protocol: string }> {
  let peer: Peer | undefined;
  if (peerId) {
    peer = await peerStore.get(peerId);
    if (!peer) {
      throw new Error(
        `Failed to retrieve connection details for provided peer in peer store: ${peerId.toString()}`
      );
    }
  } else {
    const peers = await getPeersForProtocol(peerStore, protocols);
    peer = await selectLowestLatencyPeer(peerStore, peers);
    if (!peer) {
      peer = selectRandomPeer(peers);
      if (!peer)
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
    if (connection.status === "open") {
      if (!latestConnection) {
        latestConnection = connection;
      } else if (connection.timeline.open > latestConnection.timeline.open) {
        latestConnection = connection;
      }
    }
  });

  return latestConnection;
}

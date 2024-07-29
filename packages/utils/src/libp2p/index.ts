import type { Connection, Peer, PeerStore } from "@libp2p/interface";
import { ShardInfo } from "@waku/interfaces";

import { bytesToUtf8 } from "../bytes/index.js";
import { isDefined } from "../common/is_defined.js";
import { decodeRelayShard } from "../common/relay_shard_codec.js";

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
 * Function to sort peers by latency from lowest to highest
 * @param peerStore - The Libp2p PeerStore
 * @param peers - The list of peers to choose from
 * @returns Sorted array of peers by latency
 */
export async function sortPeersByLatency(
  peerStore: PeerStore,
  peers: Peer[]
): Promise<Peer[]> {
  if (peers.length === 0) return [];

  const results = await Promise.all(
    peers.map(async (peer) => {
      try {
        const pingBytes = (await peerStore.get(peer.id)).metadata.get("ping");
        if (!pingBytes) return { peer, ping: Infinity };

        const ping = Number(bytesToUtf8(pingBytes));
        return { peer, ping };
      } catch (error) {
        return { peer, ping: Infinity };
      }
    })
  );

  // filter out null values
  const validResults = results.filter(
    (result): result is { peer: Peer; ping: number } => result !== null
  );

  return validResults
    .sort((a, b) => a.ping - b.ping)
    .map((result) => result.peer);
}

/**
 * Sorts the list of peers based on the number of active connections.
 * @param peers A list of all available peers, that support the protocol and shard.
 * @param connections A list of all active connections.
 * @returns A list of peers sorted by the number of active connections.
 */
export function sortPeersByLeastActiveConnections(
  peers: Peer[],
  connections: Connection[]
): Peer[] {
  const activePeers = connections
    .filter((conn) =>
      conn.streams.map((stream) => stream.protocol).filter(isDefined)
    )
    .map((conn) => conn.remotePeer);

  return peers.sort((a, b) => {
    const aConnections = activePeers.filter((peerId) =>
      peerId.equals(a.id)
    ).length;
    const bConnections = activePeers.filter((peerId) =>
      peerId.equals(b.id)
    ).length;

    return bConnections - aConnections;
  });
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

export async function getConnectedPeersForProtocolAndShard(
  connections: Connection[],
  peerStore: PeerStore,
  protocols: string[],
  shardInfo?: ShardInfo
): Promise<Peer[]> {
  const openConnections = connections.filter(
    (connection) => connection.status === "open"
  );

  const peerPromises = openConnections.map(async (connection) => {
    const peer = await peerStore.get(connection.remotePeer);
    const supportsProtocol = protocols.some((protocol) =>
      peer.protocols.includes(protocol)
    );

    if (supportsProtocol) {
      if (shardInfo) {
        const encodedPeerShardInfo = peer.metadata.get("shardInfo");
        const peerShardInfo =
          encodedPeerShardInfo && decodeRelayShard(encodedPeerShardInfo);

        if (peerShardInfo && shardInfo.clusterId === peerShardInfo.clusterId) {
          return peer;
        }
      } else {
        return peer;
      }
    }
    return null;
  });

  const peersWithNulls = await Promise.all(peerPromises);
  return peersWithNulls.filter((peer): peer is Peer => peer !== null);
}

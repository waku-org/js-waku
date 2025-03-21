import type { IEnr } from "@waku/interfaces";
import { Logger } from "@waku/utils";

const log = new Logger("discovery:fetch_nodes");

/**
 * Fetch nodes using passed [[getNode]]; results are validated before being
 * returned. Stops when [[getNodes]] does not return any more nodes or the
 * number call exceeds [[maxSearches]].
 */
export async function fetchAndValidateNodes(
  maxSearches: number = 10,
  getNode: () => Promise<IEnr | null>
): Promise<IEnr[]> {
  let totalSearches = 0;
  let emptyResults = 0;
  const peers: IEnr[] = [];

  while (
    totalSearches < maxSearches &&
    emptyResults < 2 // Allows a couple of empty results before calling it quit
  ) {
    const peer = await getNode();
    if (peer && isNewPeer(peer, peers)) {
      // ENRs without a waku2 key are ignored.
      if (peer.waku2) {
        peers.push(peer);
      }
      log.info(
        `got new peer candidate from DNS address=${peer.nodeId}@${peer.ip}`
      );
    } else {
      emptyResults++;
    }

    totalSearches++;
  }
  return peers;
}

/**
 * Fetch nodes using passed [[getNode]]
 */
export async function* yieldNodes(
  getNode: () => Promise<IEnr | null>
): AsyncGenerator<IEnr> {
  const peerNodeIds = new Set();

  const peer = await getNode();
  if (peer && peer.nodeId && !peerNodeIds.has(peer.nodeId)) {
    peerNodeIds.add(peer.nodeId);
    // ENRs without a waku2 key are ignored.
    if (peer.waku2) {
      yield peer;
    }
    log.info(
      `got new peer candidate from DNS address=${peer.nodeId}@${peer.ip}`
    );
  }
}

function isNewPeer(peer: IEnr, peers: IEnr[]): boolean {
  if (!peer.nodeId) return false;

  for (const existingPeer of peers) {
    if (peer.nodeId === existingPeer.nodeId) {
      return false;
    }
  }

  return true;
}

import type { IEnr } from "@waku/interfaces";
import { Logger } from "@waku/utils";

const log = new Logger("discovery:fetch_nodes");

/**
 * Fetch nodes using passed [[getNode]] until it has been called [[maxGet]]
 * times, or it has returned empty or duplicate results more than [[maxErrors]]
 * times.
 */
export async function* fetchNodes(
  getNode: () => Promise<IEnr | null>,
  maxGet: number = 10,
  maxErrors: number = 3
): AsyncGenerator<IEnr> {
  const peerNodeIds = new Set();

  let totalSearches = 0;
  let erroneousSearches = 0;

  while (
    totalSearches < maxGet &&
    erroneousSearches < maxErrors // Allows a couple of empty results before calling it quit
  ) {
    totalSearches++;

    const peer = await getNode();
    if (!peer || !peer.nodeId) {
      erroneousSearches++;
      continue;
    }

    if (!peerNodeIds.has(peer.nodeId)) {
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
}

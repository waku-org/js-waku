import type { IEnr, NodeCapabilityCount, Waku2 } from "@waku/interfaces";
import { Logger } from "@waku/utils";

const log = new Logger("discovery:fetch_nodes");

/**
 * Fetch nodes using passed [[getNode]] until all wanted capabilities are
 * fulfilled or the number of [[getNode]] call exceeds the sum of
 * [[wantedNodeCapabilityCount]] plus [[errorTolerance]].
 */
export async function fetchNodesUntilCapabilitiesFulfilled(
  wantedNodeCapabilityCount: Partial<NodeCapabilityCount>,
  errorTolerance: number,
  getNode: () => Promise<IEnr | null>
): Promise<IEnr[]> {
  const wanted = {
    relay: wantedNodeCapabilityCount.relay ?? 0,
    store: wantedNodeCapabilityCount.store ?? 0,
    filter: wantedNodeCapabilityCount.filter ?? 0,
    lightPush: wantedNodeCapabilityCount.lightPush ?? 0
  };

  const maxSearches =
    wanted.relay + wanted.store + wanted.filter + wanted.lightPush;

  const actual = {
    relay: 0,
    store: 0,
    filter: 0,
    lightPush: 0
  };

  let totalSearches = 0;
  const peers: IEnr[] = [];

  while (
    !isSatisfied(wanted, actual) &&
    totalSearches < maxSearches + errorTolerance
  ) {
    const peer = await getNode();
    if (peer && isNewPeer(peer, peers)) {
      // ENRs without a waku2 key are ignored.
      if (peer.waku2) {
        if (helpsSatisfyCapabilities(peer.waku2, wanted, actual)) {
          addCapabilities(peer.waku2, actual);
          peers.push(peer);
        }
      }
      log.info(
        `got new peer candidate from DNS address=${peer.nodeId}@${peer.ip}`
      );
    }

    totalSearches++;
  }
  return peers;
}

/**
 * Fetch nodes using passed [[getNode]] until all wanted capabilities are
 * fulfilled or the number of [[getNode]] call exceeds the sum of
 * [[wantedNodeCapabilityCount]] plus [[errorTolerance]].
 */
export async function* yieldNodesUntilCapabilitiesFulfilled(
  wantedNodeCapabilityCount: Partial<NodeCapabilityCount>,
  errorTolerance: number,
  getNode: () => Promise<IEnr | null>
): AsyncGenerator<IEnr> {
  const wanted = {
    relay: wantedNodeCapabilityCount.relay ?? 0,
    store: wantedNodeCapabilityCount.store ?? 0,
    filter: wantedNodeCapabilityCount.filter ?? 0,
    lightPush: wantedNodeCapabilityCount.lightPush ?? 0
  };

  const maxSearches =
    wanted.relay + wanted.store + wanted.filter + wanted.lightPush;

  const actual = {
    relay: 0,
    store: 0,
    filter: 0,
    lightPush: 0
  };

  let totalSearches = 0;
  const peerNodeIds = new Set();

  while (
    !isSatisfied(wanted, actual) &&
    totalSearches < maxSearches + errorTolerance
  ) {
    const peer = await getNode();
    if (peer && peer.nodeId && !peerNodeIds.has(peer.nodeId)) {
      peerNodeIds.add(peer.nodeId);
      // ENRs without a waku2 key are ignored.
      if (peer.waku2) {
        if (helpsSatisfyCapabilities(peer.waku2, wanted, actual)) {
          addCapabilities(peer.waku2, actual);
          yield peer;
        }
      }
      log.info(
        `got new peer candidate from DNS address=${peer.nodeId}@${peer.ip}`
      );
    }
    totalSearches++;
  }
}

function isSatisfied(
  wanted: NodeCapabilityCount,
  actual: NodeCapabilityCount
): boolean {
  return (
    actual.relay >= wanted.relay &&
    actual.store >= wanted.store &&
    actual.filter >= wanted.filter &&
    actual.lightPush >= wanted.lightPush
  );
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

function addCapabilities(node: Waku2, total: NodeCapabilityCount): void {
  if (node.relay) total.relay += 1;
  if (node.store) total.store += 1;
  if (node.filter) total.filter += 1;
  if (node.lightPush) total.lightPush += 1;
}

/**
 * Checks if the proposed ENR [[node]] helps satisfy the [[wanted]] capabilities,
 * considering the [[actual]] capabilities of nodes retrieved so far..
 *
 * @throws If the function is called when the wanted capabilities are already fulfilled.
 */
function helpsSatisfyCapabilities(
  node: Waku2,
  wanted: NodeCapabilityCount,
  actual: NodeCapabilityCount
): boolean {
  if (isSatisfied(wanted, actual)) {
    throw "Internal Error: Waku2 wanted capabilities are already fulfilled";
  }

  const missing = missingCapabilities(wanted, actual);

  return (
    (missing.relay && node.relay) ||
    (missing.store && node.store) ||
    (missing.filter && node.filter) ||
    (missing.lightPush && node.lightPush)
  );
}

/**
 * Return a [[Waku2]] Object for which capabilities are set to true if they are
 * [[wanted]] yet missing from [[actual]].
 */
function missingCapabilities(
  wanted: NodeCapabilityCount,
  actual: NodeCapabilityCount
): Waku2 {
  return {
    relay: actual.relay < wanted.relay,
    store: actual.store < wanted.store,
    filter: actual.filter < wanted.filter,
    lightPush: actual.lightPush < wanted.lightPush
  };
}

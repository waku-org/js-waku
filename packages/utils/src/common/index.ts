export * from "./is_defined.js";
export * from "./random_subset.js";
export * from "./group_by.js";
export * from "./to_async_iterator.js";
export * from "./is_size_valid.js";
import { Peer } from "@libp2p/interface/peer-store";
import { Tags } from "@waku/interfaces";

export function removeItemFromArray(arr: unknown[], value: unknown): unknown[] {
  const index = arr.indexOf(value);
  if (index > -1) {
    arr.splice(index, 1);
  }
  return arr;
}
/**
 * Retrieves a list of peers based on the specified criteria.
 *
 * @param peers - The list of peers to filter from.
 * @param numPeers - The total number of peers to retrieve. If 0, all peers are returned.
 * @param maxBootstrapPeers - The maximum number of bootstrap peers to retrieve.
 * @returns A Promise that resolves to an array of peers based on the specified criteria.
 */
export async function filterPeers(
  peers: Peer[],
  numPeers: number,
  maxBootstrapPeers: number
): Promise<Peer[]> {
  // Collect the bootstrap peers up to the specified maximum
  let bootstrapPeers = peers.filter((peer) => peer.tags.has(Tags.BOOTSTRAP));
  if (maxBootstrapPeers > 0) {
    bootstrapPeers = bootstrapPeers.slice(0, maxBootstrapPeers);
  }

  // Collect non-bootstrap peers
  const nonBootstrapPeers = peers.filter(
    (peer) => !peer.tags.has(Tags.BOOTSTRAP)
  );

  // If numPeers is 0, return all peers
  if (numPeers === 0) {
    return [...bootstrapPeers, ...nonBootstrapPeers];
  }

  // Initialize the list of selected peers with the bootstrap peers
  const selectedPeers: Peer[] = [...bootstrapPeers];

  // Fill up to numPeers with remaining random peers if needed
  while (selectedPeers.length < numPeers && nonBootstrapPeers.length > 0) {
    const randomIndex = Math.floor(Math.random() * nonBootstrapPeers.length);
    const randomPeer = nonBootstrapPeers.splice(randomIndex, 1)[0];
    selectedPeers.push(randomPeer);
  }

  return selectedPeers;
}

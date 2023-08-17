import type { Libp2p } from "@libp2p/interface";
import type { Stream } from "@libp2p/interface/connection";
import type { PeerId } from "@libp2p/interface/peer-id";
import { Peer, PeerStore } from "@libp2p/interface/peer-store";
import { IBaseProtocol, Libp2pComponents, Tags } from "@waku/interfaces";
import {
  getPeersForProtocol,
  selectConnection,
  selectPeerForProtocol
} from "@waku/utils/libp2p";

/**
 * A class with predefined helpers, to be used as a base to implement Waku
 * Protocols.
 */
export class BaseProtocol implements IBaseProtocol {
  public readonly addLibp2pEventListener: Libp2p["addEventListener"];
  public readonly removeLibp2pEventListener: Libp2p["removeEventListener"];

  constructor(
    public multicodec: string,
    private components: Libp2pComponents
  ) {
    this.addLibp2pEventListener = components.events.addEventListener.bind(
      components.events
    );
    this.removeLibp2pEventListener = components.events.removeEventListener.bind(
      components.events
    );
  }

  public get peerStore(): PeerStore {
    return this.components.peerStore;
  }

  /**
   * Returns known peers from the address book (`libp2p.peerStore`) that support
   * the class protocol. Waku may or may not be currently connected to these
   * peers.
   */
  public async peers(): Promise<Peer[]> {
    return getPeersForProtocol(this.peerStore, [this.multicodec]);
  }

  protected async getPeer(peerId?: PeerId): Promise<Peer> {
    const { peer } = await selectPeerForProtocol(
      this.peerStore,
      [this.multicodec],
      peerId
    );
    return peer;
  }

  /**
   * Retrieves a list of peers based on the specified criteria.
   *
   * @param numPeers - The number of peers to retrieve. If you need all available peers, specify a large number.
   * @param includeBootstrap - If true, includes a bootstrap peer in the result. Useful for protocols like Filter and Store that require only one peer for now.
   * @param peerIds - Optional list of specific peer IDs to include in the result. This allows for the inclusion of specific peers if needed.
   * @returns A Promise that resolves to an array of peers based on the specified criteria.
   */
  protected async getPeers(
    numPeers: number,
    includeBootstrap: boolean,
    peerIds?: PeerId[]
  ): Promise<Peer[]> {
    // Retrieve all peers that support the protocol
    const allPeersForProtocol = await getPeersForProtocol(this.peerStore, [
      this.multicodec
    ]);

    // Filter the bootstrap peer if required to include
    const bootstrapPeer = includeBootstrap
      ? allPeersForProtocol.find((peer) => peer.tags.has(Tags.BOOTSTRAP))
      : undefined;

    // Filter the peers that match the specified peerIds
    const matchingPeers = peerIds
      ? allPeersForProtocol.filter((peer) => peerIds.includes(peer.id))
      : [];

    // Filter remaining peers excluding bootstrap and specified peerIds
    const remainingPeers = allPeersForProtocol.filter(
      (peer) => peer !== bootstrapPeer && !matchingPeers.includes(peer)
    );

    // Initialize the list of selected peers
    const selectedPeers: Peer[] = [];

    // Add the bootstrap peer if available and required
    if (bootstrapPeer) {
      selectedPeers.push(bootstrapPeer);
    }

    // Add the specified peerIds if available
    selectedPeers.push(...matchingPeers);

    // Fill up to numPeers with remaining random peers if needed
    while (selectedPeers.length < numPeers && remainingPeers.length > 0) {
      selectedPeers.push(remainingPeers.shift()!);
    }

    // Trim the result to the specified number of peers if more were added
    return selectedPeers.slice(0, numPeers);
  }

  protected async newStream(peer: Peer): Promise<Stream> {
    const connections = this.components.connectionManager.getConnections(
      peer.id
    );
    const connection = selectConnection(connections);
    if (!connection) {
      throw new Error("Failed to get a connection to the peer");
    }

    return connection.newStream(this.multicodec);
  }
}

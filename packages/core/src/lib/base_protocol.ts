import type { Libp2p } from "@libp2p/interface";
import type { Stream } from "@libp2p/interface/connection";
import type { PeerId } from "@libp2p/interface/peer-id";
import { Peer, PeerStore } from "@libp2p/interface/peer-store";
import type { IBaseProtocol, Libp2pComponents } from "@waku/interfaces";
import { Tags } from "@waku/interfaces";
import {
  getPeersForProtocol,
  selectConnection,
  selectPeerForProtocol
} from "@waku/utils/libp2p";

import { StreamManager } from "./stream_manager.js";

/**
 * A class with predefined helpers, to be used as a base to implement Waku
 * Protocols.
 */
export class BaseProtocol implements IBaseProtocol {
  public readonly addLibp2pEventListener: Libp2p["addEventListener"];
  public readonly removeLibp2pEventListener: Libp2p["removeEventListener"];
  protected streamManager: StreamManager;

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

    this.streamManager = new StreamManager(
      multicodec,
      components.connectionManager.getConnections.bind(
        components.connectionManager
      ),
      this.addLibp2pEventListener
    );
  }
  protected async getStream(peer: Peer): Promise<Stream> {
    return this.streamManager.getStream(peer);
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
   * @param peers - The list of peers to filter from.
   * @param numPeers - The total number of peers to retrieve. If 0, all peers are returned.
   * @param maxBootstrapPeers - The maximum number of bootstrap peers to retrieve.
   * @returns A Promise that resolves to an array of peers based on the specified criteria.
   */
  private async filterPeers(
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

  /**
   * Retrieves a list of peers based on the specified criteria.
   *
   * @param numPeers - The total number of peers to retrieve. If 0, all peers are returned.
   * @param maxBootstrapPeers - The maximum number of bootstrap peers to retrieve.
   * @returns A Promise that resolves to an array of peers based on the specified criteria.
   */
  protected async getPeers({
    numPeers,
    maxBootstrapPeers
  }: {
    numPeers: number;
    maxBootstrapPeers: number;
  }): Promise<Peer[]> {
    // Retrieve all peers that support the protocol
    const allPeersForProtocol = await getPeersForProtocol(this.peerStore, [
      this.multicodec
    ]);

    // Filter the peers based on the specified criteria
    return this.filterPeers(allPeersForProtocol, numPeers, maxBootstrapPeers);
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

import type { Libp2p } from "@libp2p/interface";
import type { Peer, PeerStore, Stream } from "@libp2p/interface";
import type {
  IBaseProtocol,
  Libp2pComponents,
  ProtocolCreateOptions,
  PubsubTopic
} from "@waku/interfaces";
import { DefaultPubsubTopic } from "@waku/interfaces";
import { Logger, shardInfoToPubsubTopics } from "@waku/utils";
import {
  getConnectedPeersForProtocolAndShard,
  getPeersForProtocol,
  sortPeersByLatency
} from "@waku/utils/libp2p";

import { filterPeersByDiscovery } from "./filterPeers.js";
import { StreamManager } from "./stream_manager.js";

/**
 * A class with predefined helpers, to be used as a base to implement Waku
 * Protocols.
 */
export class BaseProtocol implements IBaseProtocol {
  public readonly addLibp2pEventListener: Libp2p["addEventListener"];
  public readonly removeLibp2pEventListener: Libp2p["removeEventListener"];
  protected streamManager: StreamManager;
  protected pubsubTopics: PubsubTopic[];

  constructor(
    public multicodec: string,
    private components: Libp2pComponents,
    private log: Logger,
    private options?: ProtocolCreateOptions
  ) {
    this.pubsubTopics = this.initializePubsubTopic(options);

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
  public async allPeers(): Promise<Peer[]> {
    return getPeersForProtocol(this.peerStore, [this.multicodec]);
  }

  public async connectedPeers(): Promise<Peer[]> {
    const peers = await this.allPeers();
    return peers.filter((peer) => {
      return (
        this.components.connectionManager.getConnections(peer.id).length > 0
      );
    });
  }

  /**
   * Retrieves a list of connected peers that support the protocol. The list is sorted by latency.
   *
   * @param numPeers - The total number of peers to retrieve. If 0, all peers are returned.
   * @param maxBootstrapPeers - The maximum number of bootstrap peers to retrieve.

  * @returns A list of peers that support the protocol sorted by latency.
  */
  protected async getPeers(
    {
      numPeers,
      maxBootstrapPeers
    }: {
      numPeers: number;
      maxBootstrapPeers: number;
    } = {
      maxBootstrapPeers: 1,
      numPeers: 0
    }
  ): Promise<Peer[]> {
    // Retrieve all connected peers that support the protocol & shard (if configured)
    const connectedPeersForProtocolAndShard =
      await getConnectedPeersForProtocolAndShard(
        this.components.connectionManager.getConnections(),
        this.peerStore,
        [this.multicodec],
        this.options?.shardInfo
      );

    // Filter the peers based on discovery & number of peers requested
    const filteredPeers = filterPeersByDiscovery(
      connectedPeersForProtocolAndShard,
      numPeers,
      maxBootstrapPeers
    );

    // Sort the peers by latency
    const sortedFilteredPeers = await sortPeersByLatency(
      this.peerStore,
      filteredPeers
    );

    if (sortedFilteredPeers.length === 0) {
      this.log.warn(
        "No peers found. Ensure you have a connection to the network."
      );
    }

    return sortedFilteredPeers;
  }

  private initializePubsubTopic(
    options?: ProtocolCreateOptions
  ): PubsubTopic[] {
    return (
      options?.pubsubTopics ??
      (options?.shardInfo
        ? shardInfoToPubsubTopics(options.shardInfo)
        : [DefaultPubsubTopic])
    );
  }
}

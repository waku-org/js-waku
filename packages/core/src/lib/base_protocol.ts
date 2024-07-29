import type { Libp2p } from "@libp2p/interface";
import type { Peer, PeerStore, Stream } from "@libp2p/interface";
import type {
  IBaseProtocolCore,
  Libp2pComponents,
  ProtocolCreateOptions,
  PubsubTopic
} from "@waku/interfaces";
import { ensureShardingConfigured, Logger } from "@waku/utils";
import {
  getConnectedPeersForProtocolAndShard,
  getPeersForProtocol,
  sortPeersByLatency,
  sortPeersByLeastActiveConnections
} from "@waku/utils/libp2p";

import { filterPeersByDiscovery } from "./filterPeers.js";
import { StreamManager } from "./stream_manager/index.js";

type GetPeersOptions = {
  prioritizeLatency?: boolean;
  numPeers: number;
  maxBootstrapPeers: number;
};

/**
 * A class with predefined helpers, to be used as a base to implement Waku
 * Protocols.
 */
export class BaseProtocol implements IBaseProtocolCore {
  public readonly addLibp2pEventListener: Libp2p["addEventListener"];
  public readonly removeLibp2pEventListener: Libp2p["removeEventListener"];
  protected streamManager: StreamManager;

  protected constructor(
    public multicodec: string,
    private components: Libp2pComponents,
    private log: Logger,
    public readonly pubsubTopics: PubsubTopic[],
    private options?: ProtocolCreateOptions
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
  public async getPeers(
    options: GetPeersOptions = {
      prioritizeLatency: true,
      maxBootstrapPeers: 1,
      numPeers: 0
    }
  ): Promise<Peer[]> {
    const { maxBootstrapPeers, numPeers, prioritizeLatency } = options;

    const activeConnections =
      this.components.connectionManager.getConnections();

    // Retrieve all connected peers that support the protocol & shard (if configured)
    const connectedPeersForProtocolAndShard =
      await getConnectedPeersForProtocolAndShard(
        activeConnections,
        this.peerStore,
        [this.multicodec],
        this.options?.shardInfo
          ? ensureShardingConfigured(this.options.shardInfo).shardInfo
          : undefined
      );

    // Filter the peers based on discovery & number of peers requested
    const filteredPeers = filterPeersByDiscovery(
      connectedPeersForProtocolAndShard,
      numPeers,
      maxBootstrapPeers
    );

    let filteredAndSortedPeers: Peer[];

    if (prioritizeLatency) {
      filteredAndSortedPeers = await sortPeersByLatency(
        this.peerStore,
        filteredPeers
      );
    } else {
      filteredAndSortedPeers = sortPeersByLeastActiveConnections(
        filteredPeers,
        activeConnections
      );
    }

    if (filteredAndSortedPeers.length === 0) {
      this.log.warn(
        "No peers found. Ensure you have a connection to the network."
      );
    }

    if (filteredAndSortedPeers.length < numPeers) {
      this.log.warn(
        `Only ${filteredAndSortedPeers.length} peers found. Requested ${numPeers}.`
      );
    }

    return filteredAndSortedPeers;
  }
}

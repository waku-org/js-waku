import type { Libp2p } from "@libp2p/interface";
import type { Stream } from "@libp2p/interface/connection";
import type { PeerId } from "@libp2p/interface/peer-id";
import { Peer, PeerStore } from "@libp2p/interface/peer-store";
import type {
  IBaseProtocol,
  Libp2pComponents,
  PubsubTopic,
  ShardInfo
} from "@waku/interfaces";
import { pubsubTopicsToShardInfo, shardInfoToPubsubTopics } from "@waku/utils";
import {
  getPeersForProtocol,
  getPeersForProtocolAndShard,
  selectPeerForProtocol
} from "@waku/utils/libp2p";

import { DefaultPubsubTopic } from "./constants.js";
import { filterPeers } from "./filterPeers.js";
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
    shardInfo?: ShardInfo
  ) {
    this.pubsubTopics = this.initializePubsubTopic(shardInfo);

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

  public get shardInfo(): ShardInfo {
    return pubsubTopicsToShardInfo(this.pubsubTopics);
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
   * @param numPeers - The total number of peers to retrieve. If 0, all peers are returned.
   * @param maxBootstrapPeers - The maximum number of bootstrap peers to retrieve.
   * @returns A Promise that resolves to an array of peers based on the specified criteria.
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
    // Retrieve all peers that support the protocol & shard
    const peersForProtocolAndShard = await getPeersForProtocolAndShard(
      this.peerStore,
      [this.multicodec],
      this.shardInfo
    );

    // Filter the peers based on the specified criteria
    return filterPeers(peersForProtocolAndShard, numPeers, maxBootstrapPeers);
  }

  private initializePubsubTopic(shardInfo?: ShardInfo): PubsubTopic[] {
    return shardInfo
      ? shardInfoToPubsubTopics(shardInfo)
      : [DefaultPubsubTopic];
  }
}

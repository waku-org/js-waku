import type { Libp2p } from "@libp2p/interface";
import type { Peer, Stream } from "@libp2p/interface";
import type {
  IBaseProtocolCore,
  Libp2pComponents,
  PubsubTopic
} from "@waku/interfaces";
import { getPeersForProtocol } from "@waku/utils/libp2p";

import { StreamManager } from "./stream_manager/index.js";

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
    protected components: Libp2pComponents,
    public readonly pubsubTopics: PubsubTopic[]
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

  /**
   * Returns known peers from the address book (`libp2p.peerStore`) that support
   * the class protocol. Waku may or may not be currently connected to these
   * peers.
   */
  public async allPeers(): Promise<Peer[]> {
    return getPeersForProtocol(this.components.peerStore, [this.multicodec]);
  }

  public async connectedPeers(): Promise<Peer[]> {
    const peers = await this.allPeers();
    return peers.filter((peer) => {
      const connections = this.components.connectionManager.getConnections(
        peer.id
      );
      return connections.length > 0;
    });
  }
}

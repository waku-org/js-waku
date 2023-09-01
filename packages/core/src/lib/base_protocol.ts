import type { Libp2p } from "@libp2p/interface";
import type { Stream } from "@libp2p/interface/connection";
import type { PeerId } from "@libp2p/interface/peer-id";
import { Peer, PeerStore } from "@libp2p/interface/peer-store";
import type { IBaseProtocol, Libp2pComponents } from "@waku/interfaces";
import { getPeersForProtocol, selectPeerForProtocol } from "@waku/utils/libp2p";

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
}

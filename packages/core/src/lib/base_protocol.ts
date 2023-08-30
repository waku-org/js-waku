import type { Libp2p } from "@libp2p/interface";
import type { PeerId } from "@libp2p/interface/peer-id";
import { Peer, PeerStore } from "@libp2p/interface/peer-store";
import type { IBaseProtocol, Libp2pComponents } from "@waku/interfaces";
import { getPeersForProtocol, selectPeerForProtocol } from "@waku/utils/libp2p";
import debug from "debug";

import { StreamManager } from "./stream_manager.js";

/**
 * A class with predefined helpers, to be used as a base to implement Waku
 * Protocols.
 */
export class BaseProtocol extends StreamManager implements IBaseProtocol {
  public readonly addLibp2pEventListener: Libp2p["addEventListener"];
  public readonly removeLibp2pEventListener: Libp2p["removeEventListener"];

  constructor(
    public multicodec: string,
    private components: Libp2pComponents,
    log: debug.Debugger
  ) {
    super(
      multicodec,
      components.connectionManager.getConnections.bind(
        components.connectionManager
      ),
      log
    );

    this.addLibp2pEventListener = components.events.addEventListener.bind(
      components.events
    );
    this.removeLibp2pEventListener = components.events.removeEventListener.bind(
      components.events
    );

    this.addLibp2pEventListener(
      "peer:update",
      this.handlePeerUpdateStreamPool.bind(this)
    );
    // TODO: might be better to check with `connection:close` event
    this.addLibp2pEventListener(
      "peer:disconnect",
      this.handlePeerDisconnectStreamPool.bind(this)
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
}

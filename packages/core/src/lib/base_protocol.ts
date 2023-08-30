import type { Libp2p, PeerUpdate } from "@libp2p/interface";
import type { Stream } from "@libp2p/interface/connection";
import type { PeerId } from "@libp2p/interface/peer-id";
import { Peer, PeerStore } from "@libp2p/interface/peer-store";
import type { IBaseProtocol, Libp2pComponents } from "@waku/interfaces";
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
  streamsPool: Map<string, Stream[]> = new Map();

  constructor(
    public multicodec: string,
    private components: Libp2pComponents,
    private log: debug.Debugger
  ) {
    this.addLibp2pEventListener = components.events.addEventListener.bind(
      components.events
    );
    this.removeLibp2pEventListener = components.events.removeEventListener.bind(
      components.events
    );

    this.addLibp2pEventListener("peer:update", this.handlePeerUpdateStreamPool);
    // TODO: might be better to check with `connection:close` event
    this.addLibp2pEventListener(
      "peer:disconnect",
      this.handlePeerDisconnectStreamPool
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

  private async newStream(peer: Peer): Promise<Stream> {
    const connections = this.components.connectionManager.getConnections(
      peer.id
    );
    const connection = selectConnection(connections);
    if (!connection) {
      throw new Error("Failed to get a connection to the peer");
    }

    return connection.newStream(this.multicodec);
  }

  protected async getStream(peer: Peer): Promise<Stream> {
    const peerStreams = this.streamsPool.get(peer.id.toString());
    if (peerStreams && peerStreams.length > 0) {
      // use the stream, remove from the pool, and add a new one
      const stream = peerStreams.pop();
      if (!stream) {
        throw new Error("Failed to get a stream from the pool");
      }
      this.replenishStreamPool(peer);
      return stream;
    }
    this.log(
      `No stream available for peer ${peer.id.toString()}. Opening a new one.`
    );
    const stream = await this.createAndSaveStream(peer);
    this.replenishStreamPool(peer);
    return stream;
  }

  private async createAndSaveStream(peer: Peer): Promise<Stream> {
    const peerStreams = this.streamsPool.get(peer.id.toString());
    const stream = await this.newStream(peer);
    if (peerStreams) {
      peerStreams.push(stream);
    } else {
      this.streamsPool.set(peer.id.toString(), [stream]);
    }
    return stream;
  }

  private replenishStreamPool = (peer: Peer): void => {
    this.createAndSaveStream(peer)
      .then(() => {
        this.log(`Replenished stream pool for peer ${peer.id.toString()}`);
      })
      .catch((err) => {
        this.log(
          `error: failed to replenish stream pool for peer ${peer.id.toString()}: ${err}`
        );
      });
  };

  private handlePeerUpdateStreamPool = (evt: CustomEvent<PeerUpdate>): void => {
    const peer = evt.detail.peer;
    if (peer.protocols.includes(this.multicodec)) {
      this.streamsPool.set(peer.id.toString(), []);
      this.log(`Optimistically opening a stream to ${peer.id.toString()}`);
      this.createAndSaveStream(peer)
        .then(() => {
          this.log(
            `optimistic stream opening succeeded for ${peer.id.toString()}`
          );
        })
        .catch((err) => {
          this.log(`error: optimistic stream opening failed: ${err}`);
        });
    }
  };

  private handlePeerDisconnectStreamPool = (evt: CustomEvent<PeerId>): void => {
    const peerId = evt.detail;
    this.streamsPool.delete(peerId.toString());
  };
}

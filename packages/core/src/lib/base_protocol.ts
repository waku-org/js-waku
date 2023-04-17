import type { Connection, Stream } from "@libp2p/interface-connection";
import type { PeerId } from "@libp2p/interface-peer-id";
import {
  Peer,
  PeerProtocolsChangeData,
  PeerStore,
} from "@libp2p/interface-peer-store";
import {
  getPeersForProtocol,
  selectConnection,
  selectPeerForProtocol,
} from "@waku/utils/libp2p";
import debug from "debug";

const log = debug("waku:base-protocol");

/**
 * A class with predefined helpers, to be used as a base to implement Waku
 * Protocols.
 */
export class BaseProtocol {
  constructor(
    public multicodec: string,
    public peerStore: PeerStore,
    protected getConnections: (peerId?: PeerId) => Connection[]
  ) {}

  /**
   * Returns known peers from the address book (`libp2p.peerStore`) that support
   * the class protocol. Waku may or may not be currently connected to these
   * peers.
   */
  async peers(): Promise<Peer[]> {
    return getPeersForProtocol(this.peerStore, [this.multicodec]);
  }

  protected async getPeer(peerId?: PeerId): Promise<Peer> {
    let peer = await this._getPeer(peerId);
    if (!peer) {
      await new Promise<void>((resolve) => {
        const cb = (evt: CustomEvent<PeerProtocolsChangeData>): void => {
          if (evt.detail.protocols.includes(this.multicodec)) {
            log("Resolving for", this.multicodec, evt.detail.protocols);
            this.peerStore.removeEventListener("change:protocols", cb);
            resolve();
          }
        };
        this.peerStore.addEventListener("change:protocols", cb);
      });
      peer = (await this._getPeer(peerId)) as Peer;
    }
    return peer;
  }

  protected async _getPeer(peerId?: PeerId): Promise<Peer | undefined> {
    try {
      const { peer } = await selectPeerForProtocol(
        this.peerStore,
        [this.multicodec],
        peerId
      );
      return peer;
    } catch (error) {
      return undefined;
    }
  }
  protected async newStream(peer: Peer): Promise<Stream> {
    const connections = this.getConnections(peer.id);
    const connection = selectConnection(connections);
    if (!connection) {
      throw new Error("Failed to get a connection to the peer");
    }

    return connection.newStream(this.multicodec);
  }
}

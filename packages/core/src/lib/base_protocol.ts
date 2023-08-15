import type { Stream } from "@libp2p/interface-connection";
import type { Libp2p } from "@libp2p/interface-libp2p";
import type { PeerId } from "@libp2p/interface-peer-id";
import { Peer, PeerStore } from "@libp2p/interface-peer-store";
import { IBaseProtocol, Libp2pComponents, Tags } from "@waku/interfaces";
import {
  getPeersForProtocol,
  selectConnection,
  selectPeerForProtocol,
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
    private components: Libp2pComponents,
    private log: debug.Debugger,
  ) {
    this.addLibp2pEventListener = components.events.addEventListener.bind(
      components.events,
    );
    this.removeLibp2pEventListener = components.events.removeEventListener.bind(
      components.events,
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
      peerId,
    );
    return peer;
  }

  protected async getPeers(peerId?: PeerId): Promise<Peer[] | Peer> {
    const selectedPeers: Peer[] = [];

    if (peerId) {
      const { peer } = await selectPeerForProtocol(
        this.peerStore,
        [this.multicodec],
        peerId,
      );

      selectedPeers.push(peer);
    }

    const allPeersForProtocol = await getPeersForProtocol(this.peerStore, [
      this.multicodec,
    ]);

    // Counter to keep track of the number of bootstrap peers
    let bootstrapPeerCount = 0;

    allPeersForProtocol.map((peer) => {
      // If the peer is a bootstrap peer and we don't have one yet, add it
      if (peer.tags.has(Tags.BOOTSTRAP) && bootstrapPeerCount < 1) {
        selectedPeers.push(peer);
        bootstrapPeerCount++;
      }
      // If we have less than 3 total peers, add non-bootstrap peers
      else if (selectedPeers.length < 3 && !peer.tags.has(Tags.BOOTSTRAP)) {
        selectedPeers.push(peer);
      }
    });

    if (bootstrapPeerCount === 0) {
      this.log(`warning: no bootstrap peers found, using random peers`);
    }

    return selectedPeers;
  }

  protected async newStream(peer: Peer): Promise<Stream> {
    const connections = this.components.connectionManager.getConnections(
      peer.id,
    );
    const connection = selectConnection(connections);
    if (!connection) {
      throw new Error("Failed to get a connection to the peer");
    }

    return connection.newStream(this.multicodec);
  }
}

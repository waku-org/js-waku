import type { PeerUpdate } from "@libp2p/interface";
import type { Stream } from "@libp2p/interface/connection";
import { Peer } from "@libp2p/interface/peer-store";
import { Libp2p } from "@waku/interfaces";
import { selectConnection } from "@waku/utils/libp2p";
import debug from "debug";

export class StreamManager {
  constructor(
    public multicodec: string,
    public getConnections: Libp2p["getConnections"],
    public addEventListener: Libp2p["addEventListener"],
    private log: debug.Debugger
  ) {
    addEventListener("peer:update", this.handlePeerUpdateStreamPool);
  }

  ongoingStreamCreations: Map<string, Promise<Stream>> = new Map();

  private async newStream(peer: Peer): Promise<Stream> {
    const connections = this.getConnections(peer.id);
    const connection = selectConnection(connections);
    if (!connection) {
      throw new Error("Failed to get a connection to the peer");
    }
    return connection.newStream(this.multicodec);
  }

  public async getStream(peer: Peer): Promise<Stream> {
    const peerIdStr = peer.id.toString();
    const streamPromise = this.ongoingStreamCreations.get(peerIdStr);

    // We have the stream, let's remove it from the map
    this.ongoingStreamCreations.delete(peerIdStr);

    this.prepareNewStream(peer);

    if (!streamPromise) {
      return this.newStream(peer); // fallback by creating a new stream on the spot
    }

    const stream = await streamPromise;

    if (stream.status === "closed") {
      return this.newStream(peer); // fallback by creating a new stream on the spot
    }

    return stream;
  }

  private prepareNewStream(peer: Peer): void {
    const streamPromise = this.newStream(peer);
    this.ongoingStreamCreations.set(peer.id.toString(), streamPromise);
  }

  protected handlePeerUpdateStreamPool = (
    evt: CustomEvent<PeerUpdate>
  ): void => {
    const peer = evt.detail.peer;
    if (peer.protocols.includes(this.multicodec)) {
      this.log(`Optimistically opening a stream to ${peer.id.toString()}`);
      this.prepareNewStream(peer);
    }
  };
}

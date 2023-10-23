import type { PeerUpdate } from "@libp2p/interface";
import type { Stream } from "@libp2p/interface/connection";
import { Peer } from "@libp2p/interface/peer-store";
import { Libp2p } from "@waku/interfaces";
import { Logger } from "@waku/utils";
import { selectConnection } from "@waku/utils/libp2p";

export class StreamManager {
  private streamPool: Map<string, Promise<Stream | void>>;
  private readonly log: Logger;

  constructor(
    public multicodec: string,
    public getConnections: Libp2p["getConnections"],
    public addEventListener: Libp2p["addEventListener"]
  ) {
    this.log = new Logger(`stream-manager:${multicodec}`);
    this.addEventListener(
      "peer:update",
      this.handlePeerUpdateStreamPool.bind(this)
    );
    this.getStream = this.getStream.bind(this);
    this.streamPool = new Map();
  }

  public async getStream(peer: Peer): Promise<Stream> {
    const peerIdStr = peer.id.toString();
    const streamPromise = this.streamPool.get(peerIdStr);

    if (!streamPromise) {
      return this.newStream(peer); // fallback by creating a new stream on the spot
    }

    // We have the stream, let's remove it from the map
    this.streamPool.delete(peerIdStr);

    this.prepareNewStream(peer);

    const stream = await streamPromise;

    if (!stream || stream.status === "closed") {
      return this.newStream(peer); // fallback by creating a new stream on the spot
    }

    return stream;
  }

  private async newStream(peer: Peer): Promise<Stream> {
    const connections = this.getConnections(peer.id);
    const connection = selectConnection(connections);
    if (!connection) {
      throw new Error("Failed to get a connection to the peer");
    }
    return connection.newStream(this.multicodec);
  }

  private prepareNewStream(peer: Peer): void {
    const streamPromise = this.newStream(peer).catch(() => {
      // No error thrown as this call is not triggered by the user
      this.log.error(
        `Failed to prepare a new stream for ${peer.id.toString()}`
      );
    });
    this.streamPool.set(peer.id.toString(), streamPromise);
  }

  private handlePeerUpdateStreamPool = (evt: CustomEvent<PeerUpdate>): void => {
    const peer = evt.detail.peer;
    if (peer.protocols.includes(this.multicodec)) {
      this.log.info(`Preemptively opening a stream to ${peer.id.toString()}`);
      this.prepareNewStream(peer);
    }
  };
}

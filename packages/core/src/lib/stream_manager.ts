import type { PeerUpdate, Stream } from "@libp2p/interface";
import type { Peer, PeerId } from "@libp2p/interface";
import { Libp2p } from "@waku/interfaces";
import { Logger } from "@waku/utils";
import { selectConnection } from "@waku/utils/libp2p";

const CONNECTION_TIMEOUT = 5_000;
const RETRY_BACKOFF_BASE = 1_000;
const MAX_RETRIES = 3;

export class StreamManager {
  private readonly streamPool: Map<string, Promise<Stream | void>>;
  private readonly log: Logger;

  constructor(
    public multicodec: string,
    public getConnections: Libp2p["getConnections"],
    public addEventListener: Libp2p["addEventListener"]
  ) {
    this.log = new Logger(`stream-manager:${multicodec}`);
    this.streamPool = new Map();

    this.addEventListener("peer:update", this.handlePeerUpdateStreamPool);
    this.getStream = this.getStream.bind(this);
  }

  public async getStream(peer: Peer): Promise<Stream | null> {
    const peerIdStr = peer.id.toString();
    const streamPromise = this.streamPool.get(peerIdStr);

    if (!streamPromise) {
      return this.createStream(peer);
    }

    this.streamPool.delete(peerIdStr);
    this.prepareNewStream(peer);

    try {
      const stream = await streamPromise;
      if (stream && stream.status !== "closed") {
        return stream;
      }
    } catch (error) {
      this.log.error(`Failed to get stream for ${peerIdStr} -- `, error);
    }

    return this.createStream(peer);
  }

  private async createStream(peer: Peer): Promise<Stream | null> {
    try {
      return await this.newStream(peer);
    } catch (error) {
      this.log.error(
        `Failed to create a new stream for ${peer.id.toString()} -- `,
        error
      );
      return null;
    }
  }

  private async newStream(peer: Peer, retries = 0): Promise<Stream> {
    const connections = this.getConnections(peer.id);
    const connection = selectConnection(connections);

    if (!connection) {
      throw new Error("Failed to get a connection to the peer");
    }

    try {
      return await connection.newStream(this.multicodec);
    } catch (error) {
      if (retries < MAX_RETRIES) {
        const backoff = RETRY_BACKOFF_BASE * Math.pow(2, retries);
        await new Promise((resolve) => setTimeout(resolve, backoff));
        return this.newStream(peer, retries + 1);
      }
      throw error;
    }
  }

  private prepareNewStream(peer: Peer): void {
    const timeoutPromise = new Promise<void>((resolve) =>
      setTimeout(resolve, CONNECTION_TIMEOUT)
    );

    const streamPromise = Promise.race([
      this.newStream(peer),
      timeoutPromise.then(() => {
        throw new Error("Connection timeout");
      })
    ]).catch((error) => {
      this.log.error(
        `Failed to prepare a new stream for ${peer.id.toString()} -- `,
        error
      );
    });

    this.streamPool.set(peer.id.toString(), streamPromise);
  }

  private handlePeerUpdateStreamPool = (evt: CustomEvent<PeerUpdate>): void => {
    const { peer } = evt.detail;

    if (peer.protocols.includes(this.multicodec)) {
      const status = this.getConnectionStatus(peer.id);

      if (status === "connected") {
        this.log.info(`Preemptively opening a stream to ${peer.id.toString()}`);
        this.prepareNewStream(peer);
      } else if (status === "disconnected") {
        const peerIdStr = peer.id.toString();
        this.streamPool.delete(peerIdStr);
        this.log.info(
          `Removed pending stream for disconnected peer ${peerIdStr}`
        );
      }
    }
  };

  private getConnectionStatus(peerId: PeerId): "connected" | "disconnected" {
    const connections = this.getConnections(peerId);
    return connections && connections.length > 0 ? "connected" : "disconnected";
  }
}

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
  }

  public async getStream(peer: Peer): Promise<Stream> {
    const peerIdStr = peer.id.toString();
    const streamPromise = this.streamPool.get(peerIdStr);

    if (!streamPromise) {
      return this.createStream(peer);
    }

    this.streamPool.delete(peerIdStr);
    this.prepareStream(peer);

    try {
      const stream = await streamPromise;
      if (stream && stream.status !== "closed") {
        return stream;
      }
    } catch (error) {
      this.log.warn(`Failed to get stream for ${peerIdStr} -- `, error);
      this.log.warn("Attempting to create a new stream for the peer");
    }

    return this.createStream(peer);
  }

  private async createStream(peer: Peer, retries = 0): Promise<Stream> {
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
        return this.createStream(peer, retries + 1);
      }
      throw new Error(
        `Failed to create a new stream for ${peer.id.toString()} -- ` + error
      );
    }
  }

  private prepareStream(peer: Peer): void {
    const timeoutPromise = new Promise<void>((resolve) =>
      setTimeout(resolve, CONNECTION_TIMEOUT)
    );

    const streamPromise = Promise.race([
      this.createStream(peer),
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
      const isConnected = this.isConnectedTo(peer.id);

      if (isConnected) {
        this.log.info(`Preemptively opening a stream to ${peer.id.toString()}`);
        this.prepareStream(peer);
      } else {
        const peerIdStr = peer.id.toString();
        this.streamPool.delete(peerIdStr);
        this.log.info(
          `Removed pending stream for disconnected peer ${peerIdStr}`
        );
      }
    }
  };

  private isConnectedTo(peerId: PeerId): boolean {
    const connections = this.getConnections(peerId);
    return connections.some((connection) => connection.status === "open");
  }
}

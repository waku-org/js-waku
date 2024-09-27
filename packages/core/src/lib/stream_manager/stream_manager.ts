import type {
  Connection,
  Peer,
  PeerId,
  PeerUpdate,
  Stream
} from "@libp2p/interface";
import type { Libp2p } from "@waku/interfaces";
import { Logger } from "@waku/utils";

import { selectConnection } from "./utils.js";

const CONNECTION_TIMEOUT = 5_000;

export class StreamManager {
  private readonly log: Logger;

  private ongoingCreation: Set<string> = new Set();
  private streamPool: Map<string, Promise<void>> = new Map();

  public constructor(
    public multicodec: string,
    public getConnections: Libp2p["getConnections"],
    public addEventListener: Libp2p["addEventListener"]
  ) {
    this.log = new Logger(`stream-manager:${multicodec}`);
    this.addEventListener("peer:update", this.handlePeerUpdateStreamPool);
  }

  public async getStream(peer: Peer): Promise<Stream> {
    const peerId = peer.id.toString();

    const scheduledStream = this.streamPool.get(peerId);
    this.streamPool.delete(peerId);
    await scheduledStream;

    const stream = this.getStreamForCodec(peer.id);

    if (stream) {
      this.log.info(
        `Found existing stream peerId=${peer.id.toString()} multicodec=${this.multicodec}`
      );
      return stream;
    }

    return this.createStream(peer);
  }

  private async createStream(peer: Peer, retries = 0): Promise<Stream> {
    const connections = this.getConnections(peer.id);
    const connection = selectConnection(connections);

    if (!connection) {
      throw new Error(
        `Failed to get a connection to the peer peerId=${peer.id.toString()} multicodec=${this.multicodec}`
      );
    }

    let lastError: unknown;
    let stream: Stream | undefined;

    for (let i = 0; i < retries + 1; i++) {
      try {
        this.log.info(
          `Attempting to create a stream for peerId=${peer.id.toString()} multicodec=${this.multicodec}`
        );
        stream = await connection.newStream(this.multicodec);
        this.log.info(
          `Created stream for peerId=${peer.id.toString()} multicodec=${this.multicodec}`
        );
      } catch (error) {
        lastError = error;
      }
    }

    if (!stream) {
      throw new Error(
        `Failed to create a new stream for ${peer.id.toString()} -- ` +
          lastError
      );
    }

    return stream;
  }

  private async createStreamWithLock(peer: Peer): Promise<void> {
    const peerId = peer.id.toString();

    if (this.ongoingCreation.has(peerId)) {
      this.log.info(
        `Skipping creation of a stream due to lock for peerId=${peerId} multicodec=${this.multicodec}`
      );
      return;
    }

    try {
      this.ongoingCreation.add(peerId);
      await this.createStream(peer);
    } finally {
      this.ongoingCreation.delete(peerId);
    }
  }

  private handlePeerUpdateStreamPool = (evt: CustomEvent<PeerUpdate>): void => {
    const { peer } = evt.detail;

    if (!peer.protocols.includes(this.multicodec)) {
      return;
    }

    const stream = this.getStreamForCodec(peer.id);

    if (stream) {
      return;
    }

    this.scheduleNewStream(peer);
  };

  private scheduleNewStream(peer: Peer): void {
    this.log.info(
      `Scheduling creation of a stream for peerId=${peer.id.toString()} multicodec=${this.multicodec}`
    );

    const timeoutPromise = new Promise<undefined>((resolve) =>
      setTimeout(() => resolve(undefined), CONNECTION_TIMEOUT)
    );

    const streamPromise = Promise.race([
      this.createStreamWithLock(peer),
      timeoutPromise
    ]);

    this.streamPool.set(peer.id.toString(), streamPromise);
  }

  private getStreamForCodec(peerId: PeerId): Stream | undefined {
    const connection: Connection | undefined = this.getConnections(peerId).find(
      (c) => c.status === "open"
    );

    if (!connection) {
      return;
    }

    const stream = connection.streams.find(
      (s) => s.protocol === this.multicodec
    );

    return stream;
  }
}

import type { Peer, PeerId, PeerUpdate, Stream } from "@libp2p/interface";
import type { Libp2pComponents } from "@waku/interfaces";
import { Logger } from "@waku/utils";

import { selectOpenConnection } from "./utils.js";

const STREAM_LOCK_KEY = "consumed";

export class StreamManager {
  private readonly log: Logger;

  private ongoingCreation: Set<string> = new Set();
  private streamPool: Map<string, Promise<void>> = new Map();

  public constructor(
    private multicodec: string,
    private readonly libp2p: Libp2pComponents
  ) {
    this.log = new Logger(`stream-manager:${multicodec}`);
    this.libp2p.events.addEventListener(
      "peer:update",
      this.handlePeerUpdateStreamPool
    );
  }

  public async getStream(peerId: PeerId): Promise<Stream> {
    const peerIdStr = peerId.toString();
    const scheduledStream = this.streamPool.get(peerIdStr);

    if (scheduledStream) {
      this.streamPool.delete(peerIdStr);
      await scheduledStream;
    }

    let stream = this.getOpenStreamForCodec(peerId);

    if (stream) {
      this.log.info(
        `Found existing stream peerId=${peerIdStr} multicodec=${this.multicodec}`
      );
      this.lockStream(peerIdStr, stream);
      return stream;
    }

    stream = await this.createStream(peerId);
    this.lockStream(peerIdStr, stream);

    return stream;
  }

  private async createStream(peerId: PeerId, retries = 0): Promise<Stream> {
    const connections = this.libp2p.connectionManager.getConnections(peerId);
    const connection = selectOpenConnection(connections);

    if (!connection) {
      throw new Error(
        `Failed to get a connection to the peer peerId=${peerId.toString()} multicodec=${this.multicodec}`
      );
    }

    let lastError: unknown;
    let stream: Stream | undefined;

    for (let i = 0; i < retries + 1; i++) {
      try {
        this.log.info(
          `Attempting to create a stream for peerId=${peerId.toString()} multicodec=${this.multicodec}`
        );
        stream = await connection.newStream(this.multicodec);
        this.log.info(
          `Created stream for peerId=${peerId.toString()} multicodec=${this.multicodec}`
        );
        break;
      } catch (error) {
        lastError = error;
      }
    }

    if (!stream) {
      throw new Error(
        `Failed to create a new stream for ${peerId.toString()} -- ` + lastError
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
      await this.createStream(peer.id);
    } catch (error) {
      this.log.error(`Failed to createStreamWithLock:`, error);
    } finally {
      this.ongoingCreation.delete(peerId);
    }

    return;
  }

  private handlePeerUpdateStreamPool = (evt: CustomEvent<PeerUpdate>): void => {
    const { peer } = evt.detail;

    if (!peer.protocols.includes(this.multicodec)) {
      return;
    }

    const stream = this.getOpenStreamForCodec(peer.id);

    if (stream) {
      return;
    }

    this.scheduleNewStream(peer);
  };

  private scheduleNewStream(peer: Peer): void {
    this.log.info(
      `Scheduling creation of a stream for peerId=${peer.id.toString()} multicodec=${this.multicodec}`
    );

    // abandon previous attempt
    if (this.streamPool.has(peer.id.toString())) {
      this.streamPool.delete(peer.id.toString());
    }

    this.streamPool.set(peer.id.toString(), this.createStreamWithLock(peer));
  }

  private getOpenStreamForCodec(peerId: PeerId): Stream | undefined {
    const connections = this.libp2p.connectionManager.getConnections(peerId);
    const connection = selectOpenConnection(connections);

    if (!connection) {
      return;
    }

    const stream = connection.streams.find(
      (s) => s.protocol === this.multicodec
    );

    if (!stream) {
      return;
    }

    const isStreamUnusable = ["done", "closed", "closing"].includes(
      stream.writeStatus || ""
    );
    if (isStreamUnusable || this.isStreamLocked(stream)) {
      return;
    }

    return stream;
  }

  private lockStream(peerId: string, stream: Stream): void {
    this.log.info(`Locking stream for peerId:${peerId}\tstreamId:${stream.id}`);
    stream.metadata[STREAM_LOCK_KEY] = true;
  }

  private isStreamLocked(stream: Stream): boolean {
    return !!stream.metadata[STREAM_LOCK_KEY];
  }
}

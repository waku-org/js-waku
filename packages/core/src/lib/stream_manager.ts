import type { PeerUpdate } from "@libp2p/interface";
import type { Stream } from "@libp2p/interface/connection";
import type { PeerId } from "@libp2p/interface/peer-id";
import { Peer } from "@libp2p/interface/peer-store";
import { Libp2p } from "@waku/interfaces";
import { selectConnection } from "@waku/utils/libp2p";
import debug from "debug";

export class StreamManager {
  private streamsPool: Map<string, Stream[]> = new Map();
  private ongoingStreamCreations: Map<string, Promise<Stream>> = new Map();
  private readonly MAX_STREAMS_PER_PEER = 3;
  private readonly MAX_RETRIES = 3;

  constructor(
    public multicodec: string,
    public getConnections: Libp2p["getConnections"],
    private log: debug.Debugger
  ) {}

  private async newStream(
    peer: Peer,
    retries = this.MAX_RETRIES
  ): Promise<Stream> {
    try {
      const connections = this.getConnections(peer.id);
      const connection = selectConnection(connections);
      if (!connection) {
        throw new Error("Failed to get a connection to the peer");
      }
      return connection.newStream(this.multicodec);
    } catch (error) {
      if (retries > 0) {
        this.log(`Retrying stream creation. Retries left: ${retries}`);
        return this.newStream(peer, retries - 1);
      }
      throw error;
    }
  }

  protected async getStream(peer: Peer): Promise<Stream> {
    const peerIdStr = peer.id.toString();

    const ongoingCreation = this.ongoingStreamCreations.get(peerIdStr);
    if (ongoingCreation) {
      // Wait for the ongoing stream creation to complete
      await ongoingCreation;
    }

    const peerStreams = this.streamsPool.get(peerIdStr) || [];
    if (peerStreams.length > 0) {
      const stream = peerStreams.pop();
      if (!stream) {
        throw new Error("Failed to get a stream from the pool");
      }
      this.replenishStreamPool(peer);
      return stream;
    }

    this.log(`No stream available for peer ${peerIdStr}. Opening a new one.`);
    return this.createAndSaveStream(peer);
  }

  private async createAndSaveStream(peer: Peer): Promise<Stream> {
    const peerIdStr = peer.id.toString();

    const streamCreationPromise = (async () => {
      const stream = await this.newStream(peer);
      const peerStreams = this.streamsPool.get(peerIdStr) || [];
      peerStreams.push(stream);
      this.streamsPool.set(peerIdStr, peerStreams);
      return stream;
    })();

    this.ongoingStreamCreations.set(peerIdStr, streamCreationPromise);

    try {
      return await streamCreationPromise;
    } finally {
      this.ongoingStreamCreations.delete(peerIdStr);
    }
  }

  private replenishStreamPool(peer: Peer): void {
    const peerIdStr = peer.id.toString();
    const ongoingCreationsCount = this.ongoingStreamCreations.has(peerIdStr)
      ? 1
      : 0;
    const availableStreamsCount = (this.streamsPool.get(peerIdStr) || [])
      .length;

    if (
      ongoingCreationsCount + availableStreamsCount <
      this.MAX_STREAMS_PER_PEER
    ) {
      this.createAndSaveStream(peer)
        .then(() => {
          this.log(`Replenished stream pool for peer ${peer.id.toString()}`);
        })
        .catch((err) => {
          this.log(
            `Error replenishing stream pool for peer ${peer.id.toString()}: ${err}`
          );
        });
    }
  }

  protected handlePeerUpdateStreamPool(evt: CustomEvent<PeerUpdate>): void {
    const peer = evt.detail.peer;
    if (peer.protocols.includes(this.multicodec)) {
      const peerIdStr = peer.id.toString();
      if (!this.streamsPool.has(peerIdStr)) {
        this.streamsPool.set(peerIdStr, []);
      }
      this.log(`Optimistically opening a stream to ${peer.id.toString()}`);
      this.replenishStreamPool(peer);
    }
  }

  protected handlePeerDisconnectStreamPool(evt: CustomEvent<PeerId>): void {
    const peerId = evt.detail;
    this.streamsPool.delete(peerId.toString());
    // Cancel ongoing stream creation if any
    this.ongoingStreamCreations.delete(peerId.toString());
  }
}

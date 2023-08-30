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

  constructor(
    public multicodec: string,
    public getConnections: Libp2p["getConnections"],
    private log: debug.Debugger
  ) {}

  private async newStream(peer: Peer): Promise<Stream> {
    const connections = this.getConnections(peer.id);
    const connection = selectConnection(connections);
    if (!connection) {
      throw new Error("Failed to get a connection to the peer");
    }
    return connection.newStream(this.multicodec);
  }

  protected async getStream(peer: Peer): Promise<Stream> {
    const peerIdStr = peer.id.toString();

    const ongoingCreation = this.ongoingStreamCreations.get(peerIdStr);
    if (ongoingCreation) {
      // Wait for the ongoing stream creation to complete
      await ongoingCreation;
    }

    const peerStreams = this.streamsPool.get(peerIdStr);
    if (peerStreams && peerStreams.length > 0) {
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

  protected handlePeerUpdateStreamPool(evt: CustomEvent<PeerUpdate>): void {
    const peer = evt.detail.peer;
    if (peer.protocols.includes(this.multicodec)) {
      this.streamsPool.set(peer.id.toString(), []);
      this.log(`Optimistically opening a stream to ${peer.id.toString()}`);
      this.createAndSaveStream(peer)
        .then(() => {
          this.log(
            `Optimistic stream opening succeeded for ${peer.id.toString()}`
          );
        })
        .catch((err) => {
          this.log(`Error during optimistic stream opening: ${err}`);
        });
    }
  }

  protected handlePeerDisconnectStreamPool(evt: CustomEvent<PeerId>): void {
    const peerId = evt.detail;
    this.streamsPool.delete(peerId.toString());
  }
}

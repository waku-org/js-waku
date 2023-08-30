import type { PeerUpdate } from "@libp2p/interface";
import type { Stream } from "@libp2p/interface/connection";
import type { PeerId } from "@libp2p/interface/peer-id";
import { Peer } from "@libp2p/interface/peer-store";
import { Libp2p } from "@waku/interfaces";
import { selectConnection } from "@waku/utils/libp2p";
import debug from "debug";

export class StreamManager {
  constructor(
    public multicodec: string,
    public getConnections: Libp2p["getConnections"],
    private log: debug.Debugger
  ) {}

  streamsPool: Map<string, Stream> = new Map();

  private async newStream(peer: Peer): Promise<Stream> {
    const connections = this.getConnections(peer.id);
    const connection = selectConnection(connections);
    if (!connection) {
      throw new Error("Failed to get a connection to the peer");
    }
    return connection.newStream(this.multicodec);
  }

  protected async getStream(peer: Peer): Promise<Stream> {
    const stream = this.streamsPool.get(peer.id.toString());
    if (stream) {
      this.replenishStreamPool(peer);
      return stream;
    }
    this.log(
      `No stream available for peer ${peer.id.toString()}. Opening a new one.`
    );
    const newStream = await this.createAndSaveStream(peer);
    this.replenishStreamPool(peer);
    return newStream;
  }

  private async createAndSaveStream(peer: Peer): Promise<Stream> {
    const stream = await this.newStream(peer);
    this.streamsPool.set(peer.id.toString(), stream);
    return stream;
  }

  private replenishStreamPool = (peer: Peer): void => {
    this.createAndSaveStream(peer)
      .then(() => {
        this.log(`Replenished stream pool for peer ${peer.id.toString()}`);
      })
      .catch((err) => {
        this.log(
          `error: failed to replenish stream pool for peer ${peer.id.toString()}: ${err}`
        );
      });
  };

  protected handlePeerUpdateStreamPool = (
    evt: CustomEvent<PeerUpdate>
  ): void => {
    const peer = evt.detail.peer;
    if (peer.protocols.includes(this.multicodec)) {
      this.log(`Optimistically opening a stream to ${peer.id.toString()}`);
      this.createAndSaveStream(peer)
        .then(() => {
          this.log(
            `optimistic stream opening succeeded for ${peer.id.toString()}`
          );
        })
        .catch((err) => {
          this.log(`error: optimistic stream opening failed: ${err}`);
        });
    }
  };

  protected handlePeerDisconnectStreamPool = (
    evt: CustomEvent<PeerId>
  ): void => {
    const peerId = evt.detail;
    this.streamsPool.delete(peerId.toString());
  };
}

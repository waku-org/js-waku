import type { PeerId } from "@libp2p/interface";
import { IncomingStreamData } from "@libp2p/interface";
import {
  type IMetadata,
  type Libp2pComponents,
  type MetadataQueryResult,
  type PeerIdStr,
  ProtocolError,
  SubscribedShardsInfo
} from "@waku/interfaces";
import { proto_metadata } from "@waku/proto";
import { encodeRelayShard, Logger } from "@waku/utils";
import all from "it-all";
import * as lp from "it-length-prefixed";
import { pipe } from "it-pipe";
import { Uint8ArrayList } from "uint8arraylist";

import { StreamManager } from "../stream_manager/index.js";

const log = new Logger("metadata");

export const MetadataCodec = "/vac/waku/metadata/1.0.0";

class Metadata implements IMetadata {
  private readonly streamManager: StreamManager;
  private readonly libp2pComponents: Libp2pComponents;
  protected handshakesConfirmed: Map<PeerIdStr, SubscribedShardsInfo> = new Map();

  public readonly multicodec = MetadataCodec;

  public constructor(
    libp2p: Libp2pComponents,
    public clusterId: number,
    public relaySubscribedShards?: number[]
  ) {
    this.streamManager = new StreamManager(MetadataCodec, libp2p);
    this.libp2pComponents = libp2p;
    void libp2p.registrar.handle(MetadataCodec, (streamData) => {
      void this.onRequest(streamData);
    });
  }

  /**
   * Make a metadata query to a peer
   */
  public async query(peerId: PeerId): Promise<MetadataQueryResult> {
    const request = proto_metadata.WakuMetadataRequest.encode({
      clusterId: this.clusterId,
      shards: this.relaySubscribedShards
    });

    const peer = await this.libp2pComponents.peerStore.get(peerId);
    if (!peer) {
      return {
        subscribedShardInfo: null,
        error: ProtocolError.NO_PEER_AVAILABLE
      };
    }

    let stream;
    try {
      stream = await this.streamManager.getStream(peerId);
    } catch (error) {
      log.error("Failed to get stream", error);
      return {
        subscribedShardInfo: null,
        error: ProtocolError.NO_STREAM_AVAILABLE
      };
    }

    const encodedResponse = await pipe(
      [request],
      lp.encode,
      stream,
      lp.decode,
      async (source) => await all(source)
    );

    const { error, subscribedShardInfo } = this.decodeMetadataResponse(encodedResponse);

    if (error) {
      return {
        subscribedShardInfo: null,
        error
      };
    }

    await this.savePeerShardInfo(peerId, subscribedShardInfo);

    return {
      subscribedShardInfo,
      error: null
    };
  }

  public async confirmOrAttemptHandshake(
    peerId: PeerId
  ): Promise<MetadataQueryResult> {
    const subscribedShardInfo = this.handshakesConfirmed.get(peerId.toString());
    if (subscribedShardInfo) {
      return {
        subscribedShardInfo,
        error: null
      };
    }

    return await this.query(peerId);
  }

  /**
   * Handle an incoming metadata request
   */
  private async onRequest(streamData: IncomingStreamData): Promise<void> {
    try {
      const { stream, connection } = streamData;
      const encodedShardInfo = proto_metadata.WakuMetadataResponse.encode(
        {clusterId: this.clusterId}
      );

      const encodedResponse = await pipe(
        [encodedShardInfo],
        lp.encode,
        stream,
        lp.decode,
        async (source) => await all(source)
      );

      const { error, subscribedShardInfo } = this.decodeMetadataResponse(encodedResponse);

      if (error) {
        return;
      }

      await this.savePeerShardInfo(connection.remotePeer, subscribedShardInfo);
    } catch (error) {
      log.error("Error handling metadata request", error);
    }
  }

  private decodeMetadataResponse(
    encodedResponse: Uint8ArrayList[]
  ): MetadataQueryResult {
    const bytes = new Uint8ArrayList();

    encodedResponse.forEach((chunk) => {
      bytes.append(chunk);
    });
    const response = proto_metadata.WakuMetadataResponse.decode(
      bytes
    ) as SubscribedShardsInfo;

    if (!response) {
      log.error("Error decoding metadata response");
      return {
        subscribedShardInfo: null,
        error: ProtocolError.DECODE_FAILED
      };
    }

    return {
      subscribedShardInfo: response,
      error: null
    };
  }

  private async savePeerShardInfo(
    peerId: PeerId,
    subscribedShardInfo: SubscribedShardsInfo
  ): Promise<void> {
    // add or update the shardInfo to peer store
    await this.libp2pComponents.peerStore.merge(peerId, {
      metadata: {
        subscribedShardInfo: encodeRelayShard(subscribedShardInfo)
      }
    });

    this.handshakesConfirmed.set(peerId.toString(), subscribedShardInfo);
  }
}

export function wakuMetadata(
  clusterId: number,
  subscribedShards?: number[]
): (components: Libp2pComponents) => IMetadata {
  return (components: Libp2pComponents) =>
    new Metadata(components, clusterId, subscribedShards);
}

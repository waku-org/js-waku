import type { PeerId } from "@libp2p/interface/peer-id";
import { IncomingStreamData } from "@libp2p/interface/stream-handler";
import type { IMetadata, Libp2pComponents, ShardInfo } from "@waku/interfaces";
import { proto_metadata } from "@waku/proto";
import { encodeRelayShard, Logger } from "@waku/utils";
import all from "it-all";
import * as lp from "it-length-prefixed";
import { pipe } from "it-pipe";
import { Uint8ArrayList } from "uint8arraylist";

import { BaseProtocol } from "../base_protocol.js";

const log = new Logger("metadata");

export const MetadataCodec = "/vac/waku/metadata/1.0.0";

class Metadata extends BaseProtocol implements IMetadata {
  private libp2pComponents: Libp2pComponents;
  handshakesConfirmed: PeerId[] = [];

  constructor(
    public shardInfo: ShardInfo,
    libp2p: Libp2pComponents
  ) {
    super(MetadataCodec, libp2p.components, shardInfo);
    this.libp2pComponents = libp2p;
    void libp2p.registrar.handle(MetadataCodec, (streamData) => {
      void this.onRequest(streamData);
    });
  }

  /**
   * Handle an incoming metadata request
   */
  private async onRequest(streamData: IncomingStreamData): Promise<void> {
    try {
      const { stream, connection } = streamData;
      const encodedShardInfo = proto_metadata.WakuMetadataResponse.encode(
        this.shardInfo
      );

      const encodedResponse = await pipe(
        [encodedShardInfo],
        lp.encode,
        stream,
        lp.decode,
        async (source) => await all(source)
      );

      const remoteShardInfoResponse =
        this.decodeMetadataResponse(encodedResponse);

      await this.savePeerShardInfo(
        connection.remotePeer,
        remoteShardInfoResponse
      );
    } catch (error) {
      log.error("Error handling metadata request", error);
    }
  }

  /**
   * Make a metadata query to a peer
   */
  async query(peerId: PeerId): Promise<ShardInfo> {
    const request = proto_metadata.WakuMetadataRequest.encode(this.shardInfo);

    const peer = await this.getPeer(peerId);

    const stream = await this.getStream(peer);

    const encodedResponse = await pipe(
      [request],
      lp.encode,
      stream,
      lp.decode,
      async (source) => await all(source)
    );

    const decodedResponse = this.decodeMetadataResponse(encodedResponse);

    await this.savePeerShardInfo(peerId, decodedResponse);

    return decodedResponse;
  }

  private decodeMetadataResponse(encodedResponse: Uint8ArrayList[]): ShardInfo {
    const bytes = new Uint8ArrayList();

    encodedResponse.forEach((chunk) => {
      bytes.append(chunk);
    });
    const response = proto_metadata.WakuMetadataResponse.decode(
      bytes
    ) as ShardInfo;

    if (!response) log.error("Error decoding metadata response");

    return response;
  }

  private async savePeerShardInfo(
    peerId: PeerId,
    shardInfo: ShardInfo
  ): Promise<void> {
    // add or update the shardInfo to peer store
    await this.libp2pComponents.peerStore.merge(peerId, {
      metadata: {
        shardInfo: encodeRelayShard(shardInfo)
      }
    });

    // add to the array removing duplicate
    this.handshakesConfirmed = [
      ...new Set([...this.handshakesConfirmed, peerId])
    ];
  }
}

export function wakuMetadata(
  shardInfo: ShardInfo
): (components: Libp2pComponents) => IMetadata {
  return (components: Libp2pComponents) => new Metadata(shardInfo, components);
}

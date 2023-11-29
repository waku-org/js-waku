import type { PeerId } from "@libp2p/interface/peer-id";
import { IncomingStreamData } from "@libp2p/interface/stream-handler";
import type { IMetadata, Libp2pComponents, ShardInfo } from "@waku/interfaces";
import { proto_metadata } from "@waku/proto";
import { Logger } from "@waku/utils";
import all from "it-all";
import * as lp from "it-length-prefixed";
import { pipe } from "it-pipe";
import { Uint8ArrayList } from "uint8arraylist";

import { BaseProtocol } from "../base_protocol.js";

const log = new Logger("metadata");

export const MetadataCodec = "/vac/waku/metadata/1.0.0";

class Metadata extends BaseProtocol {
  private readonly shardInfo: ShardInfo;
  constructor(shardInfo: ShardInfo, libp2p: Libp2pComponents) {
    super(MetadataCodec, libp2p.components);
    this.shardInfo = shardInfo;
    void libp2p.registrar.handle(MetadataCodec, (streamData) => {
      void this.onRequest(streamData);
    });
  }

  /**
   * Handle an incoming metadata request
   */
  private async onRequest(streamData: IncomingStreamData): Promise<void> {
    const encodedRpcQuery = proto_metadata.WakuMetadataRequest.encode(
      this.shardInfo
    );

    const res = await pipe(
      [encodedRpcQuery],
      lp.encode,
      streamData.stream,
      lp.decode,
      async (source) => await all(source)
    );

    const bytes = new Uint8ArrayList();
    res.forEach((chunk) => {
      bytes.append(chunk);
    });

    const shardInfoRes = proto_metadata.WakuMetadataResponse.decode(bytes);
    if (!shardInfoRes) {
      throw new Error("WakuMetadata response is undefined");
    }
    if (!shardInfoRes.clusterId) {
      throw new Error("WakuMetadata response clusterId is undefined");
    }
  }

  /**
   * Make a metadata query to a peer
   */
  async query(peerId: PeerId): Promise<ShardInfo> {
    const request = proto_metadata.WakuMetadataRequest.encode(this.shardInfo);

    try {
      const peer = await this.getPeer(peerId);

      const stream = await this.getStream(peer);

      const res = await pipe(
        [request],
        lp.encode,
        stream,
        lp.decode,
        async (source) => await all(source)
      );

      const bytes = new Uint8ArrayList();
      res.forEach((chunk) => {
        bytes.append(chunk);
      });
      const response = proto_metadata.WakuMetadataResponse.decode(bytes);
      if (!response) {
        throw new Error("Error decoding metadata response");
      }

      return response as ShardInfo;
    } catch (error) {
      log.error("Error decoding metadata response", error);
      throw error;
    }
  }
}

export function wakuMetadata(
  shardInfo: ShardInfo
): (components: Libp2pComponents) => IMetadata {
  return (components: Libp2pComponents) => new Metadata(shardInfo, components);
}

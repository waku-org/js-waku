import type { PeerId } from "@libp2p/interface/peer-id";
import type {
  IMetadata,
  Libp2p,
  MetadataQueryParams,
  ShardInfo
} from "@waku/interfaces";
import { Logger } from "@waku/utils";
import all from "it-all";
import * as lp from "it-length-prefixed";
import { pipe } from "it-pipe";
import { Uint8ArrayList } from "uint8arraylist";

import { BaseProtocol } from "../base_protocol.js";

import { MetadataRpc } from "./rpc.js";

const log = new Logger("metadata");

export const MetadataCodec = "/vac/waku/metadata/1.0.0";

class Metadata extends BaseProtocol {
  constructor(libp2p: Libp2p) {
    super(MetadataCodec, libp2p.components);
  }

  /**
   * Make a metadata query to a peer
   */
  async query(params: MetadataQueryParams, peerId: PeerId): Promise<ShardInfo> {
    const rpcQuery = MetadataRpc.createRequest(params.clusterId, params.shards);

    const peer = await this.getPeer(peerId);

    const stream = await this.getStream(peer);

    const res = await pipe(
      [rpcQuery.encode()],
      lp.encode,
      stream,
      lp.decode,
      async (source) => await all(source)
    );

    try {
      const bytes = new Uint8ArrayList();
      res.forEach((chunk) => {
        bytes.append(chunk);
      });

      const { response } = MetadataRpc.decode(bytes);
      if (!response) {
        throw new Error("No response in query");
      }

      const { shards, clusterId } = response;
      return {
        cluster: clusterId,
        indexList: shards
      } as ShardInfo;
    } catch (e) {
      log.error(`Error decoding response: ${e}`);
      throw e;
    }
  }
}

export function wakuMetadata(): (libp2p: Libp2p) => IMetadata {
  return (libp2p: Libp2p) => new Metadata(libp2p);
}

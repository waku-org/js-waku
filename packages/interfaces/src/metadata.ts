import type { PeerId } from "@libp2p/interface/peer-id";

import type { ShardInfo } from "./enr.js";
import type { IBaseProtocol } from "./protocols.js";

export interface MetadataQueryParams {
  clusterId?: number;
  shards: number[];
}

export interface IMetadata extends IBaseProtocol {
  query(
    params: MetadataQueryParams,
    peerId: PeerId
  ): Promise<ShardInfo | undefined>;
}

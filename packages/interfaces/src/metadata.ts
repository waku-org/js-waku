import type { PeerId } from "@libp2p/interface";

import { type ShardInfo } from "./enr.js";
import type {
  IBaseProtocolCore,
  ResultWithError,
  ShardingParams
} from "./protocols.js";

export type MetadataQueryResult = ResultWithError<"shardInfo", ShardInfo>;

// IMetadata always has shardInfo defined while it is optionally undefined in IBaseProtocol
export interface IMetadata extends Omit<IBaseProtocolCore, "shardInfo"> {
  shardInfo: ShardingParams;
  confirmOrAttemptHandshake(peerId: PeerId): Promise<MetadataQueryResult>;
  query(peerId: PeerId): Promise<MetadataQueryResult>;
}

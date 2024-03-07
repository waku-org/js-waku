import type { PeerId } from "@libp2p/interface";

import type { ShardInfo } from "./enr.js";
import type {
  IBaseProtocol,
  ProtocolResult,
  ShardingParams
} from "./protocols.js";

export type QueryResult = ProtocolResult<"shardInfo", ShardInfo>;

// IMetadata always has shardInfo defined while it is optionally undefined in IBaseProtocol
export interface IMetadata extends Omit<IBaseProtocol, "shardInfo"> {
  shardInfo: ShardingParams;
  confirmOrAttemptHandshake(peerId: PeerId): Promise<QueryResult>;
  query(peerId: PeerId): Promise<QueryResult>;
}

import type { PeerId } from "@libp2p/interface";

import type { ShardInfo } from "./enr.js";
import type {
  IBaseProtocol,
  ProtocolError,
  ShardingParams
} from "./protocols.js";

export type QueryResult =
  | {
      shardInfo: ShardInfo;
      error: null;
    }
  | {
      shardInfo: null;
      error: ProtocolError;
    };

// IMetadata always has shardInfo defined while it is optionally undefined in IBaseProtocol
export interface IMetadata extends Omit<IBaseProtocol, "shardInfo"> {
  shardInfo: ShardingParams;
  confirmOrAttemptHandshake(peerId: PeerId): Promise<QueryResult>;
  query(peerId: PeerId): Promise<QueryResult>;
}

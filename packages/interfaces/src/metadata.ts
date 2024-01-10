import type { PeerId } from "@libp2p/interface/peer-id";

import type { ShardInfo } from "./enr.js";
import type { IBaseProtocol, ShardingParams } from "./protocols.js";

// IMetadata always has shardInfo defined while it is optionally undefined in IBaseProtocol
export interface IMetadata extends Omit<IBaseProtocol, "shardInfo"> {
  shardInfo: ShardingParams;
  confirmOrAttemptHandshake(peerId: PeerId): Promise<void>;
  query(peerId: PeerId): Promise<ShardInfo | undefined>;
}

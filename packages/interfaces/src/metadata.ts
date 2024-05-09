import type { PeerId } from "@libp2p/interface";

import { type ShardInfo } from "./enr.js";
import { ThisOrThat } from "./misc.js";
import type { IBaseProtocolCore, ShardingParams } from "./protocols.js";

export type MetadataQueryResult = ThisOrThat<"shardInfo", ShardInfo>;

// IMetadata always has shardInfo defined while it is optionally undefined in IBaseProtocol
export interface IMetadata extends Omit<IBaseProtocolCore, "shardInfo"> {
  shardInfo: ShardingParams;
  confirmOrAttemptHandshake(peerId: PeerId): Promise<MetadataQueryResult>;
  query(peerId: PeerId): Promise<MetadataQueryResult>;
}

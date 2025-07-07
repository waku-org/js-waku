import type { PeerId } from "@libp2p/interface";

import { ThisOrThat } from "./misc.js";
import type { ShardInfo } from "./sharding.js";

export type MetadataQueryResult = ThisOrThat<"shardInfo", ShardInfo>;

export interface IMetadata {
  readonly multicodec: string;
  confirmOrAttemptHandshake(peerId: PeerId): Promise<MetadataQueryResult>;
  query(peerId: PeerId): Promise<MetadataQueryResult>;
}

import type { PeerId } from "@libp2p/interface";

import { ThisOrThat } from "./misc.js";
import type { ClusterId, RelayShards } from "./sharding.js";

export type MetadataQueryResult = ThisOrThat<"shardInfo", RelayShards>;

export interface IMetadata {
  readonly multicodec: string;
  readonly clusterId: ClusterId;
  confirmOrAttemptHandshake(peerId: PeerId): Promise<MetadataQueryResult>;
  query(peerId: PeerId): Promise<MetadataQueryResult>;
}

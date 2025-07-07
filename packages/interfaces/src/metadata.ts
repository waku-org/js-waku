import type { PeerId } from "@libp2p/interface";

import { ThisOrThat } from "./misc.js";
import { SubscribedShardsInfo } from "./sharding.js";

export type MetadataQueryResult = ThisOrThat<"subscribedShardInfo", SubscribedShardsInfo>;

export interface IMetadata {
  readonly multicodec: string;
  readonly clusterId: number;
  readonly subscribedShards?: number[];
  confirmOrAttemptHandshake(peerId: PeerId): Promise<MetadataQueryResult>;
  query(peerId: PeerId): Promise<MetadataQueryResult>;
}

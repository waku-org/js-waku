import type { PeerId } from "@libp2p/interface";

import { PubsubTopic, ThisOrThat } from "./misc.js";
import type { ShardInfo } from "./sharding.js";

export type MetadataQueryResult = ThisOrThat<"shardInfo", ShardInfo>;

export interface IMetadata {
  readonly multicodec: string;
  readonly pubsubTopics: PubsubTopic[];
  confirmOrAttemptHandshake(peerId: PeerId): Promise<MetadataQueryResult>;
  query(peerId: PeerId): Promise<MetadataQueryResult>;
}

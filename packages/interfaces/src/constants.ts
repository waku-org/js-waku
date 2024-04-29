import { ShardInfo } from "./enr";

/**
 * DefaultPubsubTopic is the default gossipsub topic to use for Waku.
 */
export const DefaultPubsubTopic = "/waku/2/default-waku/proto";

/**
 * The default cluster ID for The Waku Network
 */
export const DEFAULT_CLUSTER_ID = 1;

export const DefaultShardInfo: ShardInfo = {
  clusterId: DEFAULT_CLUSTER_ID,
  shards: [0, 1, 2, 3, 4, 5, 6, 7]
};

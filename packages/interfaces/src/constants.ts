import type { ShardInfo } from "./sharding";

/**
 * The default cluster ID for The Waku Network
 */
export const DEFAULT_CLUSTER_ID = 1;

/**
 * DefaultShardInfo is default configuration for The Waku Network.
 */
export const DefaultShardInfo: ShardInfo = {
  clusterId: DEFAULT_CLUSTER_ID,
  shards: [0, 1, 2, 3, 4, 5, 6, 7, 8]
};

export const DefaultNetworkConfig = DefaultShardInfo;

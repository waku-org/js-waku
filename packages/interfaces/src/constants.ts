import type { AutoSharding } from "./sharding";

/**
 * The default cluster ID for The Waku Network
 */
export const DEFAULT_CLUSTER_ID = 1;

/**
 * The default number of shards in a cluster.
 */
export const DEFAULT_NUM_SHARDS = 8;

/**
 * DefaultNetworkConfig is default configuration for The Waku Network.
 */
export const DefaultNetworkConfig: AutoSharding ={
  clusterId: 1,
  numShardsInNetwork: 8
}

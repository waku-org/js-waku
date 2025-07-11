/**
 * Configuration for a Waku network. All nodes in a given network/cluster
 * should have the same configuration.
 */
export type NetworkConfig = StaticSharding | AutoSharding;

export type RelayShards = {
  clusterId: ClusterId;
  shards: ShardId[];
};

export type ContentTopicInfo = {
  clusterId?: number; // TODO: This should be mandatory on a network config
  contentTopics: string[];
};

export type StaticSharding = {
  clusterId: ClusterId;
};
export type AutoSharding = {
  clusterId: ClusterId;
  numShardsInCluster: number;
};
export type ClusterId = number;
export type ShardId = number;

/**
 * Routing Information for a given message.
 */
export interface IRoutingInfo {
  pubsubTopic: string;
  networkConfig: NetworkConfig;
}

/**
 * Configuration for a Waku network. All nodes in a given network/cluster
 * should have the same configuration.
 */
export type NetworkConfig = StaticSharding | AutoSharding;

export type RelayShards = {
  clusterId: ClusterId;
  shards: ShardId[];
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
export interface IRoutingInfoAutoSharding {
  pubsubTopic: string;
  shardId: ShardId;
  networkConfig: AutoSharding;
  contentTopic: string;
  isAutoSharding: boolean;
  isStaticSharding: boolean;
}

export interface IRoutingInfoStaticSharding {
  pubsubTopic: string;
  shardId: ShardId;
  networkConfig: StaticSharding;
  isAutoSharding: boolean;
  isStaticSharding: boolean;
}

export type IRoutingInfo =
  | IRoutingInfoAutoSharding
  | IRoutingInfoStaticSharding;

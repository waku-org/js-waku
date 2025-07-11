import type {
  AutoSharding,
  ContentTopic,
  IRoutingInfo,
  NetworkConfig,
  PubsubTopic,
  ShardId,
  StaticSharding
} from "@waku/interfaces";

import {
  contentTopicToShardIndex,
  ensureValidContentTopic,
  formatPubsubTopic,
  pubsubTopicToSingleShardInfo
} from "./index.js";

export class RoutingInfo implements IRoutingInfo {
  /**
   * Create Routing Info for Auto sharding network.
   * @param contentTopic
   * @param networkConfig
   *
   * @throws if content topic is malformed.
   */
  public static fromContentTopic(
    contentTopic: ContentTopic,
    networkConfig: AutoSharding
  ): RoutingInfo {
    ensureValidContentTopic(contentTopic);

    const shardId = contentTopicToShardIndex(
      contentTopic as string,
      networkConfig.numShardsInCluster
    );
    const pubsubTopic = formatPubsubTopic(networkConfig.clusterId, shardId);

    return new RoutingInfo(networkConfig, pubsubTopic, shardId);
  }

  /**
   * Create Routing Info for static sharding network, using shard
   *
   * @param shardId
   * @param networkConfig
   */
  public static fromShard(
    shardId: ShardId,
    networkConfig: StaticSharding
  ): RoutingInfo {
    const pubsubTopic = formatPubsubTopic(networkConfig.clusterId, shardId);

    return new RoutingInfo(networkConfig, pubsubTopic, shardId);
  }

  /**
   * Create Routing Info for static sharding network, using pubsub topic
   *
   * @param pubsubTopic
   * @param networkConfig
   *
   * @throws if the pubsub topic is malformed, or does not match the network config
   */
  public static fromPubsubTopic(
    pubsubTopic: PubsubTopic,
    networkConfig: StaticSharding
  ): RoutingInfo {
    const { clusterId, shard } = pubsubTopicToSingleShardInfo(pubsubTopic);

    if (clusterId != networkConfig.clusterId)
      throw "Pubsub topic does not match network config's cluster id";

    return new RoutingInfo(networkConfig, pubsubTopic, shard);
  }

  /**
   * No checks are done with this constructor,
   * Be sure you check that the network config (auto vs static)
   * matches other parameters.
   */
  private constructor(
    public networkConfig: NetworkConfig,
    public pubsubTopic: PubsubTopic,
    public shardId: ShardId
  ) {
    this.networkConfig = networkConfig;
  }
}

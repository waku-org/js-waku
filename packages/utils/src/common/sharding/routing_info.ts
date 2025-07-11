import type {
  AutoSharding,
  ContentTopic,
  IRoutingInfoAutoSharding,
  IRoutingInfoStaticSharding,
  NetworkConfig,
  PubsubTopic,
  ShardId,
  StaticSharding
} from "@waku/interfaces";

import {
  contentTopicToShardIndex,
  ensureValidContentTopic,
  formatPubsubTopic,
  isAutoSharding,
  pubsubTopicToSingleShardInfo
} from "./index.js";

export type RoutingInfo = AutoShardingRoutingInfo | StaticShardingRoutingInfo;

export abstract class BaseRoutingInfo {
  protected constructor(
    public networkConfig: NetworkConfig,
    public pubsubTopic: PubsubTopic,
    public shardId: ShardId
  ) {}

  public abstract get isAutoSharding(): boolean;
  public abstract get isStaticSharding(): boolean;
}

export class AutoShardingRoutingInfo
  extends BaseRoutingInfo
  implements IRoutingInfoAutoSharding
{
  public static fromContentTopic(
    contentTopic: ContentTopic,
    networkConfig: AutoSharding
  ): AutoShardingRoutingInfo {
    ensureValidContentTopic(contentTopic);

    const shardId = contentTopicToShardIndex(
      contentTopic,
      networkConfig.numShardsInCluster
    );
    const pubsubTopic = formatPubsubTopic(networkConfig.clusterId, shardId);

    return new AutoShardingRoutingInfo(
      networkConfig,
      pubsubTopic,
      shardId,
      contentTopic
    );
  }

  /**
   * No checks are done with this constructor,
   * Be sure you check that the network config (auto vs static)
   * matches other parameters.
   */
  private constructor(
    public networkConfig: AutoSharding,
    public pubsubTopic: PubsubTopic,
    public shardId: ShardId,
    public contentTopic: string
  ) {
    super(networkConfig, pubsubTopic, shardId);
  }

  public get isAutoSharding(): boolean {
    return true;
  }

  public get isStaticSharding(): boolean {
    return false;
  }
}

export class StaticShardingRoutingInfo
  extends BaseRoutingInfo
  implements IRoutingInfoStaticSharding
{
  /**
   * Create Routing Info for static sharding network, using shard
   *
   * @param shardId
   * @param networkConfig
   */
  public static fromShard(
    shardId: ShardId,
    networkConfig: StaticSharding
  ): StaticShardingRoutingInfo {
    const pubsubTopic = formatPubsubTopic(networkConfig.clusterId, shardId);

    return new StaticShardingRoutingInfo(networkConfig, pubsubTopic, shardId);
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
  ): StaticShardingRoutingInfo {
    const { clusterId, shard } = pubsubTopicToSingleShardInfo(pubsubTopic);

    if (clusterId != networkConfig.clusterId)
      throw "Pubsub topic does not match network config's cluster id";

    return new StaticShardingRoutingInfo(networkConfig, pubsubTopic, shard);
  }

  /**
   * No checks are done with this constructor,
   * Be sure you check that the network config (auto vs static)
   * matches other parameters.
   */
  private constructor(
    public networkConfig: StaticSharding,
    public pubsubTopic: PubsubTopic,
    public shardId: ShardId
  ) {
    super(networkConfig, pubsubTopic, shardId);
  }

  public get isAutoSharding(): boolean {
    return false;
  }

  public get isStaticSharding(): boolean {
    return true;
  }
}

export function isAutoShardingRoutingInfo(
  routingInfo: BaseRoutingInfo
): routingInfo is AutoShardingRoutingInfo {
  return routingInfo.isAutoSharding;
}

export function isStaticShardingRoutingInfo(
  routingInfo: BaseRoutingInfo
): routingInfo is StaticShardingRoutingInfo {
  return routingInfo.isStaticSharding;
}

export function createRoutingInfo(
  networkConfig: NetworkConfig,
  options: {
    contentTopic?: ContentTopic;
    shardId?: ShardId;
    pubsubTopic?: PubsubTopic;
  }
): AutoShardingRoutingInfo | StaticShardingRoutingInfo {
  if (isAutoSharding(networkConfig)) {
    if (options.contentTopic) {
      return AutoShardingRoutingInfo.fromContentTopic(
        options.contentTopic,
        networkConfig
      );
    }
    throw new Error("AutoSharding requires contentTopic");
  } else {
    if (options.shardId !== undefined) {
      return StaticShardingRoutingInfo.fromShard(
        options.shardId,
        networkConfig
      );
    } else if (options.pubsubTopic) {
      return StaticShardingRoutingInfo.fromPubsubTopic(
        options.pubsubTopic,
        networkConfig
      );
    }
    throw new Error("StaticSharding requires shardId or pubsubTopic");
  }
}

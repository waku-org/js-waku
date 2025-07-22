import { sha256 } from "@noble/hashes/sha256";
import type {
  AutoSharding,
  ClusterId,
  ContentTopic,
  IRoutingInfo,
  NetworkConfig,
  PubsubTopic,
  ShardId,
  StaticSharding
} from "@waku/interfaces";

import { concat, utf8ToBytes } from "../../bytes/index.js";

import { isAutoSharding } from "./index.js";

const formatPubsubTopic = (
  clusterId: ClusterId,
  shard: ShardId
): PubsubTopic => {
  return `/waku/2/rs/${clusterId}/${shard}`;
};

interface ParsedContentTopic {
  generation: number;
  application: string;
  version: string;
  topicName: string;
  encoding: string;
}

function ensureValidContentTopic(
  contentTopic: ContentTopic
): ParsedContentTopic {
  const parts = (contentTopic as string).split("/");
  if (parts.length < 5 || parts.length > 6) {
    throw Error(`Content topic format is invalid: ${contentTopic}`);
  }
  // Validate generation field if present
  let generation = 0;
  if (parts.length == 6) {
    generation = parseInt(parts[1]);
    if (isNaN(generation)) {
      throw new Error(
        `Invalid generation field in content topic: ${contentTopic}`
      );
    }
    if (generation > 0) {
      throw new Error(
        `Generation greater than 0 is not supported: ${contentTopic}`
      );
    }
  }
  // Validate remaining fields
  const fields = parts.splice(-4);
  // Validate application field
  if (fields[0].length == 0) {
    throw new Error(`Application field cannot be empty: ${contentTopic}`);
  }
  // Validate version field
  if (fields[1].length == 0) {
    throw new Error(`Version field cannot be empty: ${contentTopic}`);
  }
  // Validate topic name field
  if (fields[2].length == 0) {
    throw new Error(`Topic name field cannot be empty: ${contentTopic}`);
  }
  // Validate encoding field
  if (fields[3].length == 0) {
    throw new Error(`Encoding field cannot be empty: ${contentTopic}`);
  }

  return {
    generation,
    application: fields[0],
    version: fields[1],
    topicName: fields[2],
    encoding: fields[3]
  };
}

function contentTopicToShardIndex(
  contentTopic: ContentTopic,
  numShardsInCluster: number
): number {
  const { application, version } = ensureValidContentTopic(contentTopic);
  const digest = sha256(
    concat([utf8ToBytes(application), utf8ToBytes(version)])
  );
  const dataview = new DataView(digest.buffer.slice(-8));
  return Number(dataview.getBigUint64(0, false) % BigInt(numShardsInCluster));
}

/**
 * @deprecated will be removed
 */
const pubsubTopicToSingleShardInfo = (
  pubsubTopics: PubsubTopic
): { clusterId: ClusterId; shard: ShardId } => {
  const parts = pubsubTopics.split("/");

  if (
    parts.length != 6 ||
    parts[1] !== "waku" ||
    parts[2] !== "2" ||
    parts[3] !== "rs"
  )
    throw new Error("Invalid pubsub topic");

  const clusterId = parseInt(parts[4]);
  const shard = parseInt(parts[5]);

  if (isNaN(clusterId) || isNaN(shard))
    throw new Error("Invalid clusterId or shard");

  return {
    clusterId,
    shard
  };
};

export type RoutingInfo = AutoShardingRoutingInfo | StaticShardingRoutingInfo;

export abstract class BaseRoutingInfo {
  public pubsubTopic: PubsubTopic;
  public shardId: ShardId;

  protected constructor(
    public networkConfig: NetworkConfig,
    pubsubTopic: PubsubTopic,
    shardId: ShardId
  ) {
    this.pubsubTopic = pubsubTopic;
    this.shardId = shardId;
  }

  public get clusterId(): ClusterId {
    return this.networkConfig.clusterId;
  }
}

export class AutoShardingRoutingInfo
  extends BaseRoutingInfo
  implements IRoutingInfo
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
    pubsubTopic: PubsubTopic,
    shardId: ShardId,
    public contentTopic: string
  ) {
    super(networkConfig, pubsubTopic, shardId);
  }
}

export class StaticShardingRoutingInfo
  extends BaseRoutingInfo
  implements IRoutingInfo
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
    pubsubTopic: PubsubTopic,
    shardId: ShardId
  ) {
    super(networkConfig, pubsubTopic, shardId);
  }
}

export function isAutoShardingRoutingInfo(
  routingInfo: BaseRoutingInfo
): routingInfo is AutoShardingRoutingInfo {
  return routingInfo instanceof AutoShardingRoutingInfo;
}

export function isStaticShardingRoutingInfo(
  routingInfo: BaseRoutingInfo
): routingInfo is StaticShardingRoutingInfo {
  return routingInfo instanceof StaticShardingRoutingInfo;
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

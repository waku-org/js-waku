import { NetworkConfig, PubsubTopic, SingleShardInfo } from "@waku/interfaces";
import {
  contentTopicToPubsubTopic,
  isAutoSharding,
  isStaticSharding,
  shardInfoToPubsubTopics
} from "@waku/utils";

export function derivePubsubTopicsFromNetworkConfig(
  networkConfig: NetworkConfig
): PubsubTopic[] {
  if (isStaticSharding(networkConfig)) {
    if (networkConfig.shards.length === 0) {
      throw new Error(
        "Invalid shards configuration: please provide at least one shard"
      );
    }
    return shardInfoToPubsubTopics(networkConfig);
  } else if (isAutoSharding(networkConfig)) {
    if (networkConfig.contentTopics.length === 0) {
      throw new Error(
        "Invalid content topics configuration: please provide at least one content topic"
      );
    }
    return networkConfig.contentTopics.map((contentTopic) =>
      contentTopicToPubsubTopic(contentTopic, networkConfig.clusterId, networkConfig.numShardsInNetwork)
    );
  } else {
    throw new Error(
      "Unknown shard config. Please use ShardInfo or ContentTopicInfo"
    );
  }
}

export const singleShardInfosToShardInfo = (
  singleShardInfos: SingleShardInfo[]
): SubscribedShardsInfo => {
  if (singleShardInfos.length === 0) throw new Error("Invalid shard");

  const clusterIds = singleShardInfos.map((shardInfo) => shardInfo.clusterId);
  if (new Set(clusterIds).size !== 1) {
    throw new Error("Passed shard infos have different clusterIds");
  }

  const shards = singleShardInfos
    .map((shardInfo) => shardInfo.shard)
    .filter((shard): shard is number => shard !== undefined);

  return {
    clusterId: singleShardInfos[0].clusterId,
    shards
  };
};

/**
 * Validates sharding configuration and sets defaults where possible.
 * @returns Validated sharding parameters, with any missing values set to defaults
 */
export const ensureShardingConfigured = (
  networkConfig: NetworkConfig
): {
  shardInfo: ShardInfo;
  pubsubTopics: PubsubTopic[];
} => {
  const clusterId = networkConfig.clusterId ?? DEFAULT_CLUSTER_ID;
  const shards = "shards" in networkConfig ? networkConfig.shards : [];
  const contentTopics =
    "contentTopics" in networkConfig ? networkConfig.contentTopics : [];
  const numShardsInNetwork =
    networkConfig.numShardsInNetwork ?? DEFAULT_NUM_SHARDS;

  const isShardsConfigured = shards && shards.length > 0;
  const isContentTopicsConfigured = contentTopics && contentTopics.length > 0;

  if (isShardsConfigured) {
    return {
      shardInfo: { clusterId, shards },
      pubsubTopics: shardInfoToPubsubTopics({
        clusterId,
        shards,
        numShardsInNetwork
      })
    };
  }

  if (isContentTopicsConfigured) {
    const pubsubTopics = Array.from(
      new Set(
        contentTopics.map((topic) =>
          contentTopicToPubsubTopic(topic, clusterId, numShardsInNetwork)
        )
      )
    );
    const shards = Array.from(
      new Set(
        contentTopics.map((topic) =>
          contentTopicToShardIndex(topic, numShardsInNetwork)
        )
      )
    );
    return {
      shardInfo: { clusterId, shards },
      pubsubTopics
    };
  }

  throw new Error(
    "Missing minimum required configuration options for static sharding or autosharding."
  );
};

/**
 * Given an array of content topics, groups them together by their Pubsub topic as derived using the algorithm for autosharding.
 * If any of the content topics are not properly formatted, the function will throw an error.
 */
export function contentTopicsByPubsubTopic(
  contentTopics: string[],
  clusterId: number = DEFAULT_CLUSTER_ID,
  networkShards: number = DEFAULT_NUM_SHARDS
): Map<string, Array<string>> {
  const groupedContentTopics = new Map();
  for (const contentTopic of contentTopics) {
    const pubsubTopic = contentTopicToPubsubTopic(
      contentTopic,
      clusterId,
      networkShards
    );
    let topics = groupedContentTopics.get(pubsubTopic);
    if (!topics) {
      groupedContentTopics.set(pubsubTopic, []);
      topics = groupedContentTopics.get(pubsubTopic);
    }
    topics.push(contentTopic);
  }
  return groupedContentTopics;
}

export function derivePubsubTopicsFromNetworkConfig(
  networkConfig: NetworkConfig
): PubsubTopic[] {
  if (isStaticSharding(networkConfig)) {
    if (networkConfig.shards.length === 0) {
      throw new Error(
        "Invalid shards configuration: please provide at least one shard"
      );
    }
    return shardInfoToPubsubTopics(networkConfig);
  } else if (isAutoSharding(networkConfig)) {
    if (networkConfig.contentTopics.length === 0) {
      throw new Error(
        "Invalid content topics configuration: please provide at least one content topic"
      );
    }
    return networkConfig.contentTopics.map((contentTopic) =>
      contentTopicToPubsubTopic(contentTopic, networkConfig.clusterId)
    );
  } else {
    throw new Error(
      "Unknown shard config. Please use ShardInfo or ContentTopicInfo"
    );
  }
}

import { sha256 } from "@noble/hashes/sha256";
import {
  DEFAULT_CLUSTER_ID,
  NetworkConfig,
  PubsubTopic,
  ShardInfo,
  SingleShardInfo
} from "@waku/interfaces";

import { concat, utf8ToBytes } from "../../bytes/index.js";

import { isAutoSharding, isStaticSharding } from "./type_guards.js";

export * from "./type_guards.js";

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

export const singleShardInfoToPubsubTopic = (
  shardInfo: SingleShardInfo
): PubsubTopic => {
  if (shardInfo.shard === undefined) throw new Error("Invalid shard");

  return `/waku/2/rs/${shardInfo.clusterId ?? DEFAULT_CLUSTER_ID}/${shardInfo.shard}`;
};

export const singleShardInfosToShardInfo = (
  singleShardInfos: SingleShardInfo[]
): ShardInfo => {
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
 * @deprecated will be removed, use cluster and shard comparison directly
 */
export const shardInfoToPubsubTopics = (
  shardInfo: Partial<NetworkConfig>
): PubsubTopic[] => {
  if ("contentTopics" in shardInfo && shardInfo.contentTopics) {
    // Autosharding: explicitly defined content topics
    return Array.from(
      new Set(
        shardInfo.contentTopics.map((contentTopic) =>
          contentTopicToPubsubTopic(contentTopic, shardInfo.clusterId)
        )
      )
    );
  } else if ("shards" in shardInfo) {
    // Static sharding
    if (shardInfo.shards === undefined) throw new Error("Invalid shard");
    return Array.from(
      new Set(
        shardInfo.shards.map(
          (index) =>
            `/waku/2/rs/${shardInfo.clusterId ?? DEFAULT_CLUSTER_ID}/${index}`
        )
      )
    );
  } else if ("application" in shardInfo && "version" in shardInfo) {
    // Autosharding: single shard from application and version
    return [
      contentTopicToPubsubTopic(
        `/${shardInfo.application}/${shardInfo.version}/default/default`,
        shardInfo.clusterId
      )
    ];
  } else {
    throw new Error("Missing required configuration in shard parameters");
  }
};

/**
 * @deprecated will be removed
 */
export const pubsubTopicToSingleShardInfo = (
  pubsubTopics: PubsubTopic
): SingleShardInfo => {
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

export const pubsubTopicsToShardInfo = (
  pubsubTopics: PubsubTopic[]
): ShardInfo => {
  const shardInfoSet = new Set<string>();
  const clusterIds = new Set<number>();

  for (const topic of pubsubTopics) {
    const { clusterId, shard } = pubsubTopicToSingleShardInfo(topic);
    shardInfoSet.add(`${clusterId}:${shard}`);
    clusterIds.add(clusterId);
  }

  if (shardInfoSet.size === 0) {
    throw new Error("No valid pubsub topics provided");
  }

  if (clusterIds.size > 1) {
    throw new Error(
      "Pubsub topics from multiple cluster IDs are not supported"
    );
  }

  const clusterId = clusterIds.values().next().value!;
  const shards = Array.from(shardInfoSet).map((info) =>
    parseInt(info.split(":")[1])
  );

  return {
    clusterId,
    shards
  };
};

interface ContentTopic {
  generation: number;
  application: string;
  version: string;
  topicName: string;
  encoding: string;
}

/**
 * Given a string, will throw an error if it is not formatted as a valid content topic for autosharding based on https://rfc.vac.dev/spec/51/
 * @param contentTopic String to validate
 * @returns Object with each content topic field as an attribute
 */
export function ensureValidContentTopic(contentTopic: string): ContentTopic {
  const parts = contentTopic.split("/");
  if (parts.length < 5 || parts.length > 6) {
    throw Error("Content topic format is invalid");
  }
  // Validate generation field if present
  let generation = 0;
  if (parts.length == 6) {
    generation = parseInt(parts[1]);
    if (isNaN(generation)) {
      throw new Error("Invalid generation field in content topic");
    }
    if (generation > 0) {
      throw new Error("Generation greater than 0 is not supported");
    }
  }
  // Validate remaining fields
  const fields = parts.splice(-4);
  // Validate application field
  if (fields[0].length == 0) {
    throw new Error("Application field cannot be empty");
  }
  // Validate version field
  if (fields[1].length == 0) {
    throw new Error("Version field cannot be empty");
  }
  // Validate topic name field
  if (fields[2].length == 0) {
    throw new Error("Topic name field cannot be empty");
  }
  // Validate encoding field
  if (fields[3].length == 0) {
    throw new Error("Encoding field cannot be empty");
  }

  return {
    generation,
    application: fields[0],
    version: fields[1],
    topicName: fields[2],
    encoding: fields[3]
  };
}

/**
 * Given a string, determines which autoshard index to use for its pubsub topic.
 * Based on the algorithm described in the RFC: https://rfc.vac.dev/spec/51//#algorithm
 */
export function contentTopicToShardIndex(
  contentTopic: string,
  networkShards: number = 8
): number {
  const { application, version } = ensureValidContentTopic(contentTopic);
  const digest = sha256(
    concat([utf8ToBytes(application), utf8ToBytes(version)])
  );
  const dataview = new DataView(digest.buffer.slice(-8));
  return Number(dataview.getBigUint64(0, false) % BigInt(networkShards));
}

export function contentTopicToPubsubTopic(
  contentTopic: string,
  clusterId: number = DEFAULT_CLUSTER_ID,
  networkShards: number = 8
): string {
  if (!contentTopic) {
    throw Error("Content topic must be specified");
  }

  const shardIndex = contentTopicToShardIndex(contentTopic, networkShards);
  return `/waku/2/rs/${clusterId}/${shardIndex}`;
}

/**
 * Given an array of content topics, groups them together by their Pubsub topic as derived using the algorithm for autosharding.
 * If any of the content topics are not properly formatted, the function will throw an error.
 */
export function contentTopicsByPubsubTopic(
  contentTopics: string[],
  clusterId: number = DEFAULT_CLUSTER_ID,
  networkShards: number = 8
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

/**
 * Used when creating encoders/decoders to determine which pubsub topic to use
 */
export function determinePubsubTopic(
  contentTopic: string,
  // TODO: make it accept ShardInfo https://github.com/waku-org/js-waku/issues/2086
  pubsubTopicShardInfo?: SingleShardInfo | PubsubTopic
): string {
  if (typeof pubsubTopicShardInfo == "string") {
    return pubsubTopicShardInfo;
  }

  return pubsubTopicShardInfo?.shard !== undefined
    ? singleShardInfoToPubsubTopic(pubsubTopicShardInfo)
    : contentTopicToPubsubTopic(
        contentTopic,
        pubsubTopicShardInfo?.clusterId ?? DEFAULT_CLUSTER_ID
      );
}

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

  const isShardsConfigured = shards && shards.length > 0;
  const isContentTopicsConfigured = contentTopics && contentTopics.length > 0;

  if (isShardsConfigured) {
    return {
      shardInfo: { clusterId, shards },
      pubsubTopics: shardInfoToPubsubTopics({ clusterId, shards })
    };
  }

  if (isContentTopicsConfigured) {
    const pubsubTopics = Array.from(
      new Set(
        contentTopics.map((topic) =>
          contentTopicToPubsubTopic(topic, clusterId)
        )
      )
    );
    const shards = Array.from(
      new Set(contentTopics.map((topic) => contentTopicToShardIndex(topic)))
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

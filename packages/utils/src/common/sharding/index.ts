import { sha256 } from "@noble/hashes/sha256";
import {
  DEFAULT_CLUSTER_ID,
  DEFAULT_NUM_SHARDS,
  PubsubTopic,
  SingleShardInfo,
  SubscribedShardsInfo
} from "@waku/interfaces";

import { concat, utf8ToBytes } from "../../bytes/index.js";



export const singleShardInfoToPubsubTopic = (
  clusterId: number,
  shard: number
): PubsubTopic => {
  // TODO: remove this "default".
  return `/waku/2/rs/${clusterId ?? DEFAULT_CLUSTER_ID}/${shard}`;
};

export const shardInfoToPubsubTopics = (
  shardInfo: SubscribedShardsInfo
): PubsubTopic[] => {
  if (shardInfo.shards === undefined) throw new Error("Invalid shard");
  return Array.from(
    new Set(
      shardInfo.shards.map(
        (index) =>
          `/waku/2/rs/${shardInfo.clusterId}/${index}`
      )
    )
  );
};

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

// TODO confirm it's useful
export const pubsubTopicsToShardInfo = (
  pubsubTopics: PubsubTopic[]
): SubscribedShardsInfo => {
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

//TODO: move part of BaseProtocol instead of utils
// return `ProtocolError.TOPIC_NOT_CONFIGURED` instead of throwing
export function ensurePubsubTopicIsConfigured(
  pubsubTopic: PubsubTopic,
  configuredTopics: PubsubTopic[]
): void {
  if (!configuredTopics.includes(pubsubTopic)) {
    throw new Error(
      `Pubsub topic ${pubsubTopic} has not been configured on this instance. Configured topics are: ${configuredTopics}. Please update your configuration by passing in the topic during Waku node instantiation.`
    );
  }
}

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
  networkShards: number = DEFAULT_NUM_SHARDS
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
  networkShards: number = DEFAULT_NUM_SHARDS
): string {
  if (!contentTopic) {
    throw Error("Content topic must be specified");
  }

  const shardIndex = contentTopicToShardIndex(contentTopic, networkShards);
  return `/waku/2/rs/${clusterId}/${shardIndex}`;
}



/**
 * Used when creating encoders/decoders to determine which pubsub topic to use
 */
export function determinePubsubTopic(
  contentTopic: string,
  clusterId: number,
  pubsubTopicOrShard?: PubsubTopic | number
): string {
  if (typeof pubsubTopicOrShard == "string") {
    return pubsubTopicOrShard;
  }

  // TODO: We should know whether we are using auto-sharding or static sharding
  // instead of deducing things.
  return pubsubTopicOrShard !== undefined
    ? singleShardInfoToPubsubTopic(clusterId, pubsubTopicOrShard)
    : contentTopicToPubsubTopic(
        contentTopic,
        clusterId ?? DEFAULT_CLUSTER_ID,
        pubsubTopicOrShard
        // TODO: Num network shards is never passed!
      );
}

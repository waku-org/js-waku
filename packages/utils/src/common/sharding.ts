import { sha256 } from "@noble/hashes/sha256";
import type {
  PubsubTopic,
  ShardInfo,
  SingleTopicShardInfo
} from "@waku/interfaces";

import { concat, utf8ToBytes } from "../bytes/index.js";

export const singleTopicShardInfoToPubsubTopic = (
  shardInfo: SingleTopicShardInfo
): PubsubTopic => {
  if (!shardInfo.cluster || !shardInfo.index) throw new Error("Invalid shard");

  return `/waku/2/rs/${shardInfo.cluster}/${shardInfo.index}`;
};

export const shardInfoToPubsubTopics = (
  shardInfo: ShardInfo
): PubsubTopic[] => {
  if (!shardInfo.cluster || !shardInfo.indexList)
    throw new Error("Invalid shard");

  return shardInfo.indexList.map(
    (index) => `/waku/2/rs/${shardInfo.cluster}/${index}`
  );
};

export const pubsubTopicToSingleTopicShardInfo = (
  pubsubTopics: PubsubTopic
): SingleTopicShardInfo => {
  const parts = pubsubTopics.split("/");
  if (parts.length != 5) throw new Error("Invalid pubsub topic");

  return {
    cluster: parseInt(parts[3]),
    index: parseInt(parts[4])
  };
};

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
  clusterId: number = 1,
  networkShards: number = 8
): string {
  const shardIndex = contentTopicToShardIndex(contentTopic, networkShards);
  return `/waku/2/rs/${clusterId}/${shardIndex}`;
}

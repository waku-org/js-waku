import { sha256 } from "@noble/hashes/sha256";
import {
  type ClusterId,
  ContentTopic,
  PubsubTopic,
  type ShardId
} from "@waku/interfaces";

import { concat, utf8ToBytes } from "../../bytes/index.js";

export const formatPubsubTopic = (
  clusterId: ClusterId,
  shard: ShardId
): PubsubTopic => {
  return `/waku/2/rs/${clusterId}/${shard}`;
};

/**
 * @deprecated will be removed
 */
export const pubsubTopicToSingleShardInfo = (
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

interface ParsedContentTopic {
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
export function ensureValidContentTopic(
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

/**
 * Given a string, determines which autoshard index to use for its pubsub topic.
 * Based on the algorithm described in the RFC: https://rfc.vac.dev/spec/51//#algorithm
 */
export function contentTopicToShardIndex(
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

export function contentTopicToPubsubTopic(
  contentTopic: ContentTopic,
  clusterId: number,
  numShardsInCluster: number
): string {
  if (!contentTopic) {
    throw Error("Content topic must be specified");
  }

  const shardIndex = contentTopicToShardIndex(contentTopic, numShardsInCluster);
  return `/waku/2/rs/${clusterId}/${shardIndex}`;
}

/**
 * Given an array of content topics, groups them together by their Pubsub topic as derived using the algorithm for autosharding.
 * If any of the content topics are not properly formatted, the function will throw an error.
 */
export function contentTopicsByPubsubTopic(
  contentTopics: ContentTopic[],
  clusterId: number,
  networkShards: number
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

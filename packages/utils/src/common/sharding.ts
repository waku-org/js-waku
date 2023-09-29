import type { PubSubTopic, ShardInfo } from "@waku/interfaces";

import { bytesToUtf8, utf8ToBytes } from "../bytes/index.js";

export const getPubsubTopicsFromShardInfo = (
  shardInfo: ShardInfo
): PubSubTopic[] => {
  return shardInfo.indices.map(
    (index) => `/waku/2/rs/${shardInfo.cluster}/${index}`
  );
};

export function ensurePubsubTopicIsConfigured(
  pubsubTopic: PubSubTopic,
  configuredTopics: PubSubTopic[]
): void {
  if (!configuredTopics.includes(pubsubTopic)) {
    throw new Error(
      `PubSub topic ${pubsubTopic} has not been configured on this instance. Configured topics are: ${configuredTopics}. Please update your configuration by passing in the topic during Waku node instantiation.`
    );
  }
}

//TODO: this can be generalized
export function shardInfoToBytes(shardInfo: ShardInfo): Uint8Array {
  return utf8ToBytes(JSON.stringify(shardInfo));
}

export function bytesToShardInfo(bytes: Uint8Array): ShardInfo {
  return JSON.parse(bytesToUtf8(bytes));
}

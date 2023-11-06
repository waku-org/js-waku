import type { PubsubTopic, ShardInfo } from "@waku/interfaces";

export const shardInfoToPubsubTopics = (
  shardInfo: ShardInfo
): PubsubTopic[] => {
  return shardInfo.indexList.map(
    (index) => `/waku/2/rs/${shardInfo.cluster}/${index}`
  );
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

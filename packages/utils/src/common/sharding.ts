import type { PubSubTopic } from "@waku/interfaces";

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

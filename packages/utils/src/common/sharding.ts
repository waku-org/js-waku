import type { PubSubTopic } from "@waku/interfaces";

export function ensurePubsubTopicIsValid(
  pubsubTopic: PubSubTopic,
  configuredTopics: PubSubTopic[]
): void {
  if (!configuredTopics.includes(pubsubTopic)) {
    throw new Error(
      `PubSub topic ${pubsubTopic} is not supported by this protocol. Configured topics are: ${configuredTopics}. Please update your configuration by passing in the topic during Waku node instantiation.`
    );
  }
}

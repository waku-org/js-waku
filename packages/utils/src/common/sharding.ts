import type {
  PubsubTopic,
  ShardInfo,
  SingleTopicShardInfo
} from "@waku/interfaces";

export const singleTopicShardInfoToPubsubTopic = (
  shardInfo: SingleTopicShardInfo
): PubsubTopic => {
  return `/waku/2/rs/${shardInfo.cluster}/${shardInfo.index}`;
};

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

/**
 * Given a string, will throw an error if it is not formatted as a valid content topic for autosharding based on https://rfc.vac.dev/spec/51/
 * @param contentTopic String to validate
 */
export function ensureValidContentTopic(contentTopic: string): void {
  const parts = contentTopic.split("/");
  if (parts.length < 5 || parts.length > 6) {
    throw Error("Content topic format is invalid");
  }
  // Validate generation field if present
  if (parts.length == 6) {
    const generation = parseInt(parts[1]);
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
}

import { createDecoder, createEncoder, Decoder, Encoder } from "@waku/core";

// Utility to generate test data for multiple topics tests.
export function generateTestData(topicCount: number): {
  contentTopics: string[];
  encoders: Encoder[];
  decoders: Decoder[];
} {
  const contentTopics = Array.from(
    { length: topicCount },
    (_, i) => `/test/${i + 1}/waku-multi`
  );
  const encoders = contentTopics.map((topic) =>
    createEncoder({ contentTopic: topic })
  );
  const decoders = contentTopics.map((topic) => createDecoder(topic));
  return {
    contentTopics,
    encoders,
    decoders
  };
}

// Utility to generate sharded pubsub topic string
export function createTestShardedTopic(cluster: number, index: number): string {
  return `/waku/2/rs/${cluster}/${index}`;
}

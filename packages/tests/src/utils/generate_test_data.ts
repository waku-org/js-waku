import { createDecoder, createEncoder } from "@waku/core";
import { IDecoder, IEncoder } from "@waku/interfaces";

type TestDataOptions = {
  pubsubTopic: string;
};

// Utility to generate test data for multiple topics tests.
export function generateTestData(
  topicCount: number,
  options?: TestDataOptions
): {
  contentTopics: string[];
  encoders: IEncoder[];
  decoders: IDecoder[];
} {
  const contentTopics = Array.from(
    { length: topicCount },
    (_, i) => `/test/${i + 1}/waku-multi/default`
  );
  const encoders = contentTopics.map((topic) =>
    createEncoder({ contentTopic: topic, pubsubTopic: options?.pubsubTopic })
  );
  const decoders = contentTopics.map((topic) =>
    createDecoder(topic, options?.pubsubTopic)
  );
  return {
    contentTopics,
    encoders,
    decoders
  };
}

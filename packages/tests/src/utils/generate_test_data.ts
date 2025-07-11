import { createDecoder, createEncoder, Decoder, Encoder } from "@waku/core";
import { RoutingInfo } from "@waku/utils";

// Utility to generate test data for multiple topics tests.
export function generateTestData(
  topicCount: number,
  routingInfo: RoutingInfo
): {
  contentTopics: string[];
  encoders: Encoder[];
  decoders: Decoder[];
} {
  const contentTopics = Array.from(
    { length: topicCount },
    (_, i) => `/test/${i + 1}/waku-multi/default`
  );
  const encoders = contentTopics.map((topic) =>
    createEncoder({ contentTopic: topic, routingInfo })
  );
  const decoders = contentTopics.map((topic) =>
    createDecoder(topic, routingInfo)
  );
  return {
    contentTopics,
    encoders,
    decoders
  };
}

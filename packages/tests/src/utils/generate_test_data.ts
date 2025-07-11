import { createDecoder, createEncoder, Decoder, Encoder } from "@waku/core";
import { AutoSharding } from "@waku/interfaces";
import { createRoutingInfo } from "@waku/utils";

// Utility to generate test data for multiple topics tests.
export function generateTestData(
  topicCount: number,
  networkConfig: AutoSharding
): {
  contentTopics: string[];
  encoders: Encoder[];
  decoders: Decoder[];
} {
  const contentTopics = Array.from(
    { length: topicCount },
    // Remember that auto-sharding uses both app name and app version fields
    (_, i) => `/test/0/waku-multi-${i + 1}/default`
  );
  const encoders = contentTopics.map((topic) =>
    createEncoder({
      contentTopic: topic,
      routingInfo: createRoutingInfo(networkConfig, { contentTopic: topic })
    })
  );
  const decoders = contentTopics.map((topic) =>
    createDecoder(
      topic,
      createRoutingInfo(networkConfig, { contentTopic: topic })
    )
  );

  return {
    contentTopics,
    encoders,
    decoders
  };
}

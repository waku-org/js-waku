import { createDecoder, createEncoder, Decoder, Encoder } from "@waku/core";

import { DOCKER_IMAGE_NAME } from "../lib/service_node";

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

// Utility to add test conditions based on nwaku/go-waku versions
export function isNwakuAtLeast(requiredVersion: string): boolean {
  const versionRegex = /(?:v)?(\d+\.\d+(?:\.\d+)?)/;
  const match = DOCKER_IMAGE_NAME.match(versionRegex);

  if (match) {
    const version = match[0].substring(1); // Remove the 'v' prefix
    return (
      version.localeCompare(requiredVersion, undefined, { numeric: true }) >= 0
    );
  } else {
    // If there is no match we assume that it's a version close to master so we return True
    return true;
  }
}

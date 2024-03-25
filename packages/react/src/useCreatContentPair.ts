import { createDecoder, createEncoder, waku } from "@waku/sdk";
import React from "react";

import type { ContentPair } from "./types";

/**
 * Creates Encoder / Decoder pair for a given contentTopic.
 * @param {string} contentTopic - topic to orient to
 * @param {boolean} ephemeral - makes messages ephemeral, default to false
 * @returns {Object} Encoder / Decoder pair
 */
export const useCreateContentPair = (
  contentTopic: string,
  ephemeral = false
): ContentPair => {
  const [encoder, setEncoder] = React.useState<waku.Encoder>(
    createEncoder({ contentTopic, ephemeral })
  );
  const [decoder, setDecoder] = React.useState<waku.Decoder>(
    createDecoder(contentTopic)
  );

  React.useEffect(() => {
    setEncoder(createEncoder({ contentTopic, ephemeral }));
    setDecoder(createDecoder(contentTopic));
  }, [contentTopic, ephemeral]);

  return {
    encoder,
    decoder
  };
};

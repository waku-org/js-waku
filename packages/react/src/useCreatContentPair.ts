import type {
  AutoSharding,
  IDecodedMessage,
  IDecoder,
  IEncoder
} from "@waku/interfaces";
import { createDecoder, createEncoder } from "@waku/sdk";
import { createRoutingInfo } from "@waku/utils";
import React from "react";

import type { ContentPair } from "./types.js";

const defaultNetworkConfig: AutoSharding = {
  clusterId: 0,
  numShardsInCluster: 8
};

/**
 * Creates Encoder / Decoder pair for a given contentTopic.
 * @param {string} contentTopic - topic to orient to
 * @param {boolean} ephemeral - makes messages ephemeral, default to false
 * @param {AutoSharding} networkConfig - optional network config, defaults to cluster 0 with 8 shards
 * @returns {Object} Encoder / Decoder pair
 */
export const useCreateContentPair = (
  contentTopic: string,
  ephemeral = false,
  networkConfig: AutoSharding = defaultNetworkConfig
): ContentPair => {
  const routingInfo = React.useMemo(
    () => createRoutingInfo(networkConfig, { contentTopic }),
    [contentTopic, networkConfig.clusterId, networkConfig.numShardsInCluster]
  );

  const [encoder, setEncoder] = React.useState<IEncoder>(
    createEncoder({ contentTopic, ephemeral, routingInfo })
  );
  const [decoder, setDecoder] = React.useState<IDecoder<IDecodedMessage>>(
    createDecoder(contentTopic, routingInfo)
  );

  React.useEffect(() => {
    const newRoutingInfo = createRoutingInfo(networkConfig, { contentTopic });
    setEncoder(
      createEncoder({ contentTopic, ephemeral, routingInfo: newRoutingInfo })
    );
    setDecoder(createDecoder(contentTopic, newRoutingInfo));
  }, [
    contentTopic,
    ephemeral,
    networkConfig.clusterId,
    networkConfig.numShardsInCluster
  ]);

  return {
    encoder,
    decoder
  };
};

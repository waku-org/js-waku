import {
  CreateNodeOptions,
  DefaultNetworkConfig,
  RelayNode
} from "@waku/interfaces";
import { createLibp2pAndUpdateOptions, WakuNode } from "@waku/sdk";
import { derivePubsubTopicsFromNetworkConfig, Logger } from "@waku/utils";

import { Relay, RelayCreateOptions, wakuGossipSub } from "./relay.js";

const log = new Logger("relay:create");

/**
 * Create a Waku node that uses Waku Relay to send and receive messages,
 * enabling some privacy preserving properties.
 * * @remarks
 * This function creates a Relay Node using the Waku Relay protocol.
 * While it is technically possible to use this function in a browser environment,
 * it is not recommended due to potential performance issues and limited browser capabilities.
 * If you are developing a browser-based application, consider alternative approaches like creating a Light Node
 * or use this function with caution.
 */
export async function createRelayNode(
  options: CreateNodeOptions & Partial<RelayCreateOptions>
): Promise<RelayNode> {
  options = {
    ...options,
    libp2p: {
      ...options.libp2p,
      services: {
        pubsub: wakuGossipSub(options)
      }
    }
  };

  const libp2p = await createLibp2pAndUpdateOptions(options);

  const pubsubTopics = derivePubsubTopicsFromNetworkConfig(
    options?.networkConfig ?? DefaultNetworkConfig
  );
  log.info("Creating Waku relay node with pubsub topics", pubsubTopics);

  const relay = new Relay({
    pubsubTopics: pubsubTopics || [],
    libp2p
  });

  return new WakuNode(
    pubsubTopics,
    options as CreateNodeOptions,
    libp2p,
    {},
    relay
  ) as RelayNode;
}

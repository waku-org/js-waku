import {
  CreateNodeOptions,
  DefaultNetworkConfig,
  LightNode
} from "@waku/interfaces";
import { derivePubsubTopicsFromNetworkConfig, Logger } from "@waku/utils";

import { WakuNode } from "../waku/index.js";

import { createLibp2pAndUpdateOptions } from "./libp2p.js";

const log = new Logger("sdk:create");

/**
 * Create a Waku node that uses Waku Light Push, Filter and Store to send and
 * receive messages, enabling low resource consumption.
 * Uses Waku Filter V2 by default.
 */
export async function createLightNode(
  options: CreateNodeOptions = {}
): Promise<LightNode> {
  const libp2p = await createLibp2pAndUpdateOptions(options);

  const pubsubTopics = derivePubsubTopicsFromNetworkConfig(
    options?.networkConfig ?? DefaultNetworkConfig
  );
  log.info("Creating Waku node with pubsub topics", pubsubTopics);

  const node = new WakuNode(pubsubTopics, options, libp2p, {
    store: true,
    lightpush: true,
    filter: true
  }) as LightNode;

  // only if `false` is passed explicitly
  if (options?.autoStart !== false) {
    await node.start();
  }

  return node;
}

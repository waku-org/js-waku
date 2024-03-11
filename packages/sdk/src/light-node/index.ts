import { wakuFilter, wakuStore } from "@waku/core";
import { type Libp2pComponents, type LightNode } from "@waku/interfaces";

import { wakuLightPush } from "../protocols/light_push.js";
import { createLibp2pAndUpdateOptions } from "../utils/libp2p.js";
import { CreateWakuNodeOptions, WakuNode, WakuOptions } from "../waku.js";

export { Libp2pComponents };

/**
 * Create a Waku node configured to use autosharding or static sharding.
 */
export async function createNode(
  options: CreateWakuNodeOptions = { pubsubTopics: [] }
): Promise<LightNode> {
  if (!options.shardInfo) {
    throw new Error("Shard info must be set");
  }

  const libp2p = await createLibp2pAndUpdateOptions(options);

  const store = wakuStore(options);
  const lightPush = wakuLightPush(options);
  const filter = wakuFilter(options);

  return new WakuNode(
    options as WakuOptions,
    libp2p,
    store,
    lightPush,
    filter
  ) as LightNode;
}

/**
 * Create a Waku node that uses Waku Light Push, Filter and Store to send and
 * receive messages, enabling low resource consumption.
 * Uses Waku Filter V2 by default.
 */
export async function createLightNode(
  options: CreateWakuNodeOptions = {}
): Promise<LightNode> {
  const libp2p = await createLibp2pAndUpdateOptions(options);

  const store = wakuStore(options);
  const lightPush = wakuLightPush(options);
  const filter = wakuFilter(options);

  return new WakuNode(
    options as WakuOptions,
    libp2p,
    store,
    lightPush,
    filter
  ) as LightNode;
}

import { type LightNode } from "@waku/interfaces";

import { CreateWakuNodeOptions, WakuNode } from "../waku.js";

import { createLibp2pAndUpdateOptions } from "./libp2p.js";

/**
 * Create a Waku node that uses Waku Light Push, Filter and Store to send and
 * receive messages, enabling low resource consumption.
 * Uses Waku Filter V2 by default.
 */
export async function createLightNode(
  options: CreateWakuNodeOptions = {}
): Promise<LightNode> {
  const { libp2p, pubsubTopics } = await createLibp2pAndUpdateOptions(options);

  return new WakuNode(pubsubTopics, options, libp2p, {
    store: true,
    lightpush: true,
    filter: true
  }) as LightNode;
}

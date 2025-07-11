import type { CreateNodeOptions, LightNode } from "@waku/interfaces";

import { WakuNode } from "../waku/index.js";

import { createLibp2pAndUpdateOptions } from "./libp2p.js";

/**
 * Create a Waku node that uses Waku Light Push, Filter and Store to send and
 * receive messages, enabling low resource consumption.
 * Uses Waku Filter V2 by default.
 */
export async function createLightNode(
  options: CreateNodeOptions = {}
): Promise<LightNode> {
  const libp2p = await createLibp2pAndUpdateOptions(options);

  const node = new WakuNode(options, libp2p, {
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

import { type Libp2pComponents, type LightNode } from "@waku/interfaces";

import { createLibp2pAndUpdateOptions } from "../utils/libp2p.js";
import { CreateWakuNodeOptions, WakuNode, WakuOptions } from "../waku.js";

export { Libp2pComponents };

/**
 * Create a Waku node that uses Waku Light Push, Filter and Store to send and
 * receive messages, enabling low resource consumption.
 * Uses Waku Filter V2 by default.
 */
export async function createLightNode(
  options: CreateWakuNodeOptions = {}
): Promise<LightNode> {
  const libp2p = await createLibp2pAndUpdateOptions(options);

  return new WakuNode(options as WakuOptions, libp2p, {
    store: true,
    lightpush: true,
    filter: true
  }) as LightNode;
}

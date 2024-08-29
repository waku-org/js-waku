import type { RelayNode } from "@waku/interfaces";
import { RelayCreateOptions } from "@waku/relay";

import { createLibp2pAndUpdateOptions } from "../create/libp2p.js";
import { CreateWakuNodeOptions, WakuNode, WakuOptions } from "../waku.js";

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
  options: CreateWakuNodeOptions & Partial<RelayCreateOptions>
): Promise<RelayNode> {
  const { libp2p, pubsubTopics } = await createLibp2pAndUpdateOptions(options);

  return new WakuNode(pubsubTopics, options as WakuOptions, libp2p, {
    relay: true
  }) as RelayNode;
}

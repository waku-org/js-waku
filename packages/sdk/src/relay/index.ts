import { WakuNode, WakuOptions } from "@waku/core";
import type { ProtocolCreateOptions, RelayNode } from "@waku/interfaces";
import { RelayCreateOptions, wakuGossipSub, wakuRelay } from "@waku/relay";

import { defaultLibp2p, defaultPeerDiscoveries } from "../create.js";

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
  options?: ProtocolCreateOptions & WakuOptions & Partial<RelayCreateOptions>
): Promise<RelayNode> {
  options = options ?? {};

  const libp2pOptions = options?.libp2p ?? {};
  const peerDiscovery = libp2pOptions.peerDiscovery ?? [];
  if (options?.defaultBootstrap) {
    peerDiscovery.push(...defaultPeerDiscoveries());
    Object.assign(libp2pOptions, { peerDiscovery });
  }

  const libp2p = await defaultLibp2p(
    options.shardInfo,
    wakuGossipSub(options),
    libp2pOptions,
    options?.userAgent
  );

  const relay = wakuRelay(options);

  return new WakuNode(
    options,
    options.pubsubTopics,
    libp2p,
    options.shardInfo,
    undefined,
    undefined,
    undefined,
    relay
  ) as RelayNode;
}

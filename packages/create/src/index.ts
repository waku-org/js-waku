import type { GossipSub } from "@chainsafe/libp2p-gossipsub";
import { noise } from "@chainsafe/libp2p-noise";
import type { Libp2p } from "@libp2p/interface-libp2p";
import type { PeerDiscovery } from "@libp2p/interface-peer-discovery";
import { mplex } from "@libp2p/mplex";
import { webSockets } from "@libp2p/websockets";
import { all as filterAll } from "@libp2p/websockets/filters";
import {
  DefaultUserAgent,
  RelayCreateOptions,
  wakuFilter,
  wakuGossipSub,
  wakuLightPush,
  WakuNode,
  WakuOptions,
  wakuRelay,
  wakuStore,
} from "@waku/core";
import { enrTree, wakuDnsDiscovery } from "@waku/dns-discovery";
import type {
  FullNode,
  LightNode,
  ProtocolCreateOptions,
  RelayNode,
} from "@waku/interfaces";
import { createLibp2p, Libp2pOptions } from "libp2p";

import type { Libp2pComponents } from "./libp2p_components.js";

const DEFAULT_NODE_REQUIREMENTS = {
  lightPush: 1,
  filter: 1,
  store: 1,
};

export { Libp2pComponents };

/**
 * Create a Waku node that uses Waku Light Push, Filter and Store to send and
 * receive messages, enabling low resource consumption.
 * **Note: This is NOT compatible with nwaku v0.11**
 *
 * @see https://github.com/status-im/nwaku/issues/1085
 */
export async function createLightNode(
  options?: ProtocolCreateOptions & WakuOptions
): Promise<LightNode> {
  const libp2pOptions = options?.libp2p ?? {};
  const peerDiscovery = libp2pOptions.peerDiscovery ?? [];
  if (options?.defaultBootstrap) {
    peerDiscovery.push(defaultPeerDiscovery());
    Object.assign(libp2pOptions, { peerDiscovery });
  }

  const libp2p = await defaultLibp2p(
    undefined,
    libp2pOptions,
    options?.userAgent
  );

  const store = wakuStore(options);
  const lightPush = wakuLightPush(options);
  const filter = wakuFilter(options);

  return new WakuNode(
    options ?? {},
    libp2p,
    store,
    lightPush,
    filter
  ) as LightNode;
}

/**
 * Create a Waku node that uses Waku Relay to send and receive messages,
 * enabling some privacy preserving properties.
 */
export async function createRelayNode(
  options?: ProtocolCreateOptions & WakuOptions & Partial<RelayCreateOptions>
): Promise<RelayNode> {
  const libp2pOptions = options?.libp2p ?? {};
  const peerDiscovery = libp2pOptions.peerDiscovery ?? [];
  if (options?.defaultBootstrap) {
    peerDiscovery.push(defaultPeerDiscovery());
    Object.assign(libp2pOptions, { peerDiscovery });
  }

  const libp2p = await defaultLibp2p(
    wakuGossipSub(options),
    libp2pOptions,
    options?.userAgent
  );

  const relay = wakuRelay(options);

  return new WakuNode(
    options ?? {},
    libp2p,
    undefined,
    undefined,
    undefined,
    relay
  ) as RelayNode;
}

/**
 * Create a Waku node that uses all Waku protocols.
 *
 * This helper is not recommended except if:
 * - you are interfacing with nwaku v0.11 or below
 * - you are doing some form of testing
 *
 * If you are building a full node, it is recommended to use
 * [nwaku](github.com/status-im/nwaku) and its JSON RPC API or wip REST API.
 *
 * @see https://github.com/status-im/nwaku/issues/1085
 * @internal
 */
export async function createFullNode(
  options?: ProtocolCreateOptions & WakuOptions & Partial<RelayCreateOptions>
): Promise<FullNode> {
  const libp2pOptions = options?.libp2p ?? {};
  const peerDiscovery = libp2pOptions.peerDiscovery ?? [];
  if (options?.defaultBootstrap) {
    peerDiscovery.push(defaultPeerDiscovery());
    Object.assign(libp2pOptions, { peerDiscovery });
  }

  const libp2p = await defaultLibp2p(
    wakuGossipSub(options),
    libp2pOptions,
    options?.userAgent
  );

  const store = wakuStore(options);
  const lightPush = wakuLightPush(options);
  const filter = wakuFilter(options);
  const relay = wakuRelay(options);

  return new WakuNode(
    options ?? {},
    libp2p,
    store,
    lightPush,
    filter,
    relay
  ) as FullNode;
}

export function defaultPeerDiscovery(): (
  components: Libp2pComponents
) => PeerDiscovery {
  return wakuDnsDiscovery(enrTree["PROD"], DEFAULT_NODE_REQUIREMENTS);
}

export async function defaultLibp2p(
  wakuGossipSub?: (components: Libp2pComponents) => GossipSub,
  options?: Partial<Libp2pOptions>,
  userAgent?: string
): Promise<Libp2p> {
  const libp2pOpts = Object.assign(
    {
      transports: [webSockets({ filter: filterAll })],
      streamMuxers: [mplex()],
      connectionEncryption: [noise()],
      identify: {
        host: {
          agentVersion: userAgent ?? DefaultUserAgent,
        },
      },
    } as Libp2pOptions,
    wakuGossipSub ? { pubsub: wakuGossipSub } : {},
    options ?? {}
  );

  return createLibp2p(libp2pOpts);
}

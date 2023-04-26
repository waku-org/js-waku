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
  wakuFilterV2,
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
  IFilterV1,
  IFilterV2,
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
 * Implements generics to allow for conditional type checking for Filter V1 and V2 protocols.
 * If useFilterV2 is set to true, the node will use Filter V2 protocol and the return type on `LightNode` will be set to `true`.
 * If useFilterV2 is set to false or undefined, the node will use Filter V1 protocol and the return type on `LightNode` will be set to `false`.
 *
 * **Note: This is NOT compatible with nwaku v0.11**
 *
 * @see https://github.com/status-im/nwaku/issues/1085
 */
export async function createLightNode<FilterV2 extends boolean = false>(
  options?: ProtocolCreateOptions & WakuOptions & { useFilterV2?: FilterV2 }
): Promise<LightNode<FilterV2 extends true ? true : false>> {
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

  let filter: (libp2p: Libp2p) => IFilterV1 | IFilterV2;

  if (options?.useFilterV2) {
    filter = wakuFilterV2(options) as (libp2p: Libp2p) => IFilterV2;
  } else {
    filter = wakuFilter(options) as (libp2p: Libp2p) => IFilterV1;
  }

  return new WakuNode(
    options ?? {},
    libp2p,
    store,
    lightPush,
    filter
  ) as LightNode<FilterV2 extends true ? true : false>;
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
 * Implements generics to allow for conditional type checking for Filter V1 and V2 protocols.
 * If useFilterV2 is set to true, the node will use Filter V2 protocol and the return type on `LightNode` will be set to `true`.
 * If useFilterV2 is set to false or undefined, the node will use Filter V1 protocol and the return type on `LightNode` will be set to `false`.
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
export async function createFullNode<FilterV2 extends boolean = false>(
  options?: ProtocolCreateOptions & WakuOptions & Partial<RelayCreateOptions>
): Promise<FullNode<FilterV2 extends true ? true : false>> {
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

  let filter: (libp2p: Libp2p) => IFilterV1 | IFilterV2;
  if (!options?.useFilterV2) {
    filter = wakuFilter(options);
  } else {
    filter = wakuFilterV2(options);
  }

  const relay = wakuRelay(options);

  return new WakuNode(
    options ?? {},
    libp2p,
    store,
    lightPush,
    filter,
    relay
  ) as FullNode<FilterV2 extends true ? true : false>;
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

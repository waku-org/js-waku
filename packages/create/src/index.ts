import { Noise } from "@chainsafe/libp2p-noise";
import type { PeerDiscovery } from "@libp2p/interface-peer-discovery";
import { Mplex } from "@libp2p/mplex";
import { WebSockets } from "@libp2p/websockets";
import { all as filterAll } from "@libp2p/websockets/filters";
import {
  waku,
  waku_relay,
  WakuFilter,
  WakuLightPush,
  WakuNode,
  WakuRelay,
  WakuStore,
} from "@waku/core";
import { DefaultUserAgent } from "@waku/core";
import { PeerDiscoveryStaticPeers } from "@waku/core/lib/peer_discovery_static_list";
import { getPredefinedBootstrapNodes } from "@waku/core/lib/predefined_bootstrap_nodes";
import type { WakuFull, WakuLight, WakuPrivacy } from "@waku/interfaces";
import type { Libp2p } from "libp2p";
import { createLibp2p, Libp2pOptions } from "libp2p";

type WakuOptions = waku.WakuOptions;
type RelayCreateOptions = waku_relay.CreateOptions;

export interface CreateOptions {
  /**
   * The PubSub Topic to use.
   *
   * One and only one pubsub topic is used by Waku. This is used by:
   * - WakuRelay to receive, route and send messages,
   * - WakuLightPush to send messages,
   * - WakuStore to retrieve messages.
   *
   * The usage of the default pubsub topic is recommended.
   * See [Waku v2 Topic Usage Recommendations](https://rfc.vac.dev/spec/23/) for details.
   */
  pubSubTopic?: string;
  /**
   * You can pass options to the `Libp2p` instance used by {@link index.waku.WakuNode} using the {@link CreateOptions.libp2p} property.
   * This property is the same type than the one passed to [`Libp2p.create`](https://github.com/libp2p/js-libp2p/blob/master/doc/API.md#create)
   * apart that we made the `modules` property optional and partial,
   * allowing its omission and letting Waku set good defaults.
   * Notes that some values are overridden by {@link index.waku.WakuNode} to ensure it implements the Waku protocol.
   */
  libp2p?: Partial<Libp2pOptions>;
  /**
   * Byte array used as key for the noise protocol used for connection encryption
   * by [`Libp2p.create`](https://github.com/libp2p/js-libp2p/blob/master/doc/API.md#create)
   * This is only used for test purposes to not run out of entropy during CI runs.
   */
  staticNoiseKey?: Uint8Array;
  /**
   * Use recommended bootstrap method to discovery and connect to new nodes.
   */
  defaultBootstrap?: boolean;
}

/**
 * Create a Waku node that uses Waku Light Push, Filter and Store to send and
 * receive messages, enabling low resource consumption.
 * **Note: This is NOT compatible with nwaku v0.11**
 *
 * @see https://github.com/status-im/nwaku/issues/1085
 */
export async function createLightNode(
  options?: CreateOptions & WakuOptions
): Promise<WakuLight> {
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

  const wakuStore = new WakuStore(libp2p, options);
  const wakuLightPush = new WakuLightPush(libp2p, options);
  const wakuFilter = new WakuFilter(libp2p, options);

  return new WakuNode(
    options ?? {},
    libp2p,
    wakuStore,
    wakuLightPush,
    wakuFilter
  ) as WakuLight;
}

/**
 * Create a Waku node that uses Waku Relay to send and receive messages,
 * enabling some privacy preserving properties.
 */
export async function createPrivacyNode(
  options?: CreateOptions & WakuOptions & Partial<RelayCreateOptions>
): Promise<WakuPrivacy> {
  const libp2pOptions = options?.libp2p ?? {};
  const peerDiscovery = libp2pOptions.peerDiscovery ?? [];
  if (options?.defaultBootstrap) {
    peerDiscovery.push(defaultPeerDiscovery());
    Object.assign(libp2pOptions, { peerDiscovery });
  }

  const libp2p = await defaultLibp2p(
    new WakuRelay(options),
    libp2pOptions,
    options?.userAgent
  );

  return new WakuNode(options ?? {}, libp2p) as WakuPrivacy;
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
  options?: CreateOptions & WakuOptions & Partial<RelayCreateOptions>
): Promise<WakuFull> {
  const libp2pOptions = options?.libp2p ?? {};
  const peerDiscovery = libp2pOptions.peerDiscovery ?? [];
  if (options?.defaultBootstrap) {
    peerDiscovery.push(defaultPeerDiscovery());
    Object.assign(libp2pOptions, { peerDiscovery });
  }

  const libp2p = await defaultLibp2p(
    new WakuRelay(options),
    libp2pOptions,
    options?.userAgent
  );

  const wakuStore = new WakuStore(libp2p, options);
  const wakuLightPush = new WakuLightPush(libp2p, options);
  const wakuFilter = new WakuFilter(libp2p, options);

  return new WakuNode(
    options ?? {},
    libp2p,
    wakuStore,
    wakuLightPush,
    wakuFilter
  ) as WakuFull;
}

export function defaultPeerDiscovery(): PeerDiscovery {
  return new PeerDiscoveryStaticPeers(getPredefinedBootstrapNodes());
}

export async function defaultLibp2p(
  wakuRelay?: WakuRelay,
  options?: Partial<Libp2pOptions>,
  userAgent?: string
): Promise<Libp2p> {
  const libp2pOpts = Object.assign(
    {
      transports: [new WebSockets({ filter: filterAll })],
      streamMuxers: [new Mplex()],
      connectionEncryption: [new Noise()],
      identify: {
        host: userAgent ?? DefaultUserAgent,
      },
    } as Libp2pOptions,
    wakuRelay ? { pubsub: wakuRelay } : {},
    options ?? {}
  );

  return createLibp2p(libp2pOpts);
}

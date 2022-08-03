import { Noise } from "@chainsafe/libp2p-noise";
import type { PeerDiscovery } from "@libp2p/interface-peer-discovery";
import { Mplex } from "@libp2p/mplex";
import { WebSockets } from "@libp2p/websockets";
import { all as filterAll } from "@libp2p/websockets/filters";
import { createLibp2p, Libp2pOptions } from "libp2p";
import type { Libp2p } from "libp2p";

import { getPredefinedBootstrapNodes } from "./peer_discovery_dns/predefined";
import { PeerDiscoveryStaticPeers } from "./peer_discovery_static_list";
import { Waku, WakuOptions } from "./waku";
import { WakuFilter } from "./waku_filter";
import { WakuLightPush } from "./waku_light_push";
import { WakuRelay } from "./waku_relay";
import { WakuStore } from "./waku_store";

export interface CreateOptions {
  /**
   * The PubSub Topic to use. Defaults to {@link DefaultPubSubTopic}.
   *
   * One and only one pubsub topic is used by Waku. This is used by:
   * - WakuRelay to receive, route and send messages,
   * - WakuLightPush to send messages,
   * - WakuStore to retrieve messages.
   *
   * The usage of the default pubsub topic is recommended.
   * See [Waku v2 Topic Usage Recommendations](https://rfc.vac.dev/spec/23/) for details.
   *
   * @default {@link DefaultPubSubTopic}
   */
  pubSubTopic?: string;
  /**
   * You can pass options to the `Libp2p` instance used by {@link Waku} using the {@link CreateOptions.libp2p} property.
   * This property is the same type than the one passed to [`Libp2p.create`](https://github.com/libp2p/js-libp2p/blob/master/doc/API.md#create)
   * apart that we made the `modules` property optional and partial,
   * allowing its omission and letting Waku set good defaults.
   * Notes that some values are overridden by {@link Waku} to ensure it implements the Waku protocol.
   */
  libp2p?: Partial<Libp2pOptions>;
  /**
   * Byte array used as key for the noise protocol used for connection encryption
   * by [`Libp2p.create`](https://github.com/libp2p/js-libp2p/blob/master/doc/API.md#create)
   * This is only used for test purposes to not run out of entropy during CI runs.
   */
  staticNoiseKey?: Uint8Array;
  /**
   * Use libp2p-bootstrap to discover and connect to new nodes.
   *
   * See [[BootstrapOptions]] for available parameters.
   *
   * Note: It overrides any other peerDiscovery modules that may have been set via
   * {@link CreateOptions.libp2p}.
   */
  defaultBootstrap?: boolean;
}

export async function createWaku(
  options?: CreateOptions & WakuOptions
): Promise<Waku> {
  const libp2pOptions = options?.libp2p ?? {};
  const peerDiscovery = libp2pOptions.peerDiscovery ?? [];
  if (options?.defaultBootstrap) {
    peerDiscovery.push(defaultPeerDiscovery());
    Object.assign(libp2pOptions, { peerDiscovery });
  }

  const libp2p = await defaultLibp2p(new WakuRelay(options), libp2pOptions);

  const wakuStore = new WakuStore(libp2p, options);
  const wakuLightPush = new WakuLightPush(libp2p, options);
  const wakuFilter = new WakuFilter(libp2p, options);

  return new Waku(options ?? {}, libp2p, wakuStore, wakuLightPush, wakuFilter);
}

export function defaultPeerDiscovery(): PeerDiscovery {
  return new PeerDiscoveryStaticPeers(getPredefinedBootstrapNodes());
}

export async function defaultLibp2p(
  wakuRelay: WakuRelay,
  options?: Partial<Libp2pOptions>
): Promise<Libp2p> {
  const libp2pOpts = Object.assign(
    {
      transports: [new WebSockets({ filter: filterAll })],
      streamMuxers: [new Mplex()],
      connectionEncryption: [new Noise()],
    },
    { pubsub: wakuRelay },
    options ?? {}
  );

  return createLibp2p(libp2pOpts);
}

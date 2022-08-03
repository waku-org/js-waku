import { Noise } from "@chainsafe/libp2p-noise";
import { Mplex } from "@libp2p/mplex";
import { WebSockets } from "@libp2p/websockets";
import { all as filterAll } from "@libp2p/websockets/filters";
import { createLibp2p, Libp2pOptions } from "libp2p";

import { Bootstrap, BootstrapOptions } from "./discovery";
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
  bootstrap?: BootstrapOptions;
}

export async function createWaku(
  options?: CreateOptions & WakuOptions
): Promise<Waku> {
  const peerDiscovery = [];
  if (options?.bootstrap) {
    peerDiscovery.push(new Bootstrap(options?.bootstrap));
  }

  const libp2pOpts = Object.assign(
    {
      transports: [new WebSockets({ filter: filterAll })],
      streamMuxers: [new Mplex()],
      pubsub: new WakuRelay(options),
      connectionEncryption: [new Noise()],
      peerDiscovery: peerDiscovery,
    },
    options?.libp2p ?? {}
  );

  const libp2p = await createLibp2p(libp2pOpts);

  const wakuStore = new WakuStore(libp2p, options);
  const wakuLightPush = new WakuLightPush(libp2p, options);
  const wakuFilter = new WakuFilter(libp2p, options);

  return new Waku(options ?? {}, libp2p, wakuStore, wakuLightPush, wakuFilter);
}

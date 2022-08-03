import type { PeerId } from "@libp2p/interface-peer-id";
import type { Peer } from "@libp2p/interface-peer-store";
import all from "it-all";
import * as lp from "it-length-prefixed";
import { pipe } from "it-pipe";
import { Libp2p } from "libp2p";
import { concat } from "uint8arrays/concat";

import { PushResponse } from "../../proto/light_push";
import { DefaultPubSubTopic } from "../constants";
import { getPeersForProtocol, selectRandomPeer } from "../select_peer";
import { WakuMessage } from "../waku_message";

import { PushRPC } from "./push_rpc";

export const LightPushCodec = "/vac/waku/lightpush/2.0.0-beta1";
export { PushResponse };

export interface CreateOptions {
  /**
   * The PubSub Topic to use. Defaults to {@link DefaultPubSubTopic}.
   *
   * The usage of the default pubsub topic is recommended.
   * See [Waku v2 Topic Usage Recommendations](https://rfc.vac.dev/spec/23/) for details.
   *
   * @default {@link DefaultPubSubTopic}
   */
  pubSubTopic?: string;
}

export interface PushOptions {
  peerId?: PeerId;
  pubSubTopic?: string;
}

/**
 * Implements the [Waku v2 Light Push protocol](https://rfc.vac.dev/spec/19/).
 */
export class WakuLightPush {
  pubSubTopic: string;

  constructor(public libp2p: Libp2p, options?: CreateOptions) {
    this.pubSubTopic = options?.pubSubTopic ?? DefaultPubSubTopic;
  }

  async push(
    message: WakuMessage,
    opts?: PushOptions
  ): Promise<PushResponse | null> {
    let peer;
    if (opts?.peerId) {
      peer = await this.libp2p.peerStore.get(opts.peerId);
      if (!peer) throw "Peer is unknown";
    } else {
      peer = await this.randomPeer();
    }
    if (!peer) throw "No peer available";
    if (!peer.protocols.includes(LightPushCodec))
      throw "Peer does not register waku light push protocol";

    const connections = this.libp2p.connectionManager.getConnections(peer.id);
    if (!connections) throw "Failed to get a connection to the peer";

    // TODO: Appropriate connection management
    const stream = await connections[0].newStream(LightPushCodec);
    try {
      const pubSubTopic = opts?.pubSubTopic
        ? opts.pubSubTopic
        : this.pubSubTopic;
      const query = PushRPC.createRequest(message, pubSubTopic);
      const res = await pipe(
        [query.encode()],
        lp.encode(),
        stream,
        lp.decode(),
        async (source) => await all(source)
      );
      try {
        const bytes = concat(res);
        const response = PushRPC.decode(bytes).response;

        if (!response) {
          console.log("No response in PushRPC");
          return null;
        }

        return response;
      } catch (err) {
        console.log("Failed to decode push reply", err);
      }
    } catch (err) {
      console.log("Failed to send waku light push request", err);
    }
    return null;
  }

  /**
   * Returns known peers from the address book (`libp2p.peerStore`) that support
   * light push protocol. Waku may or may not be currently connected to these
   * peers.
   */
  async peers(): Promise<Peer[]> {
    return getPeersForProtocol(this.libp2p, [LightPushCodec]);
  }

  /**
   * Returns a random peer that supports light push protocol from the address
   * book (`libp2p.peerStore`). Waku may or  may not be currently connected to
   * this peer.
   */
  async randomPeer(): Promise<Peer | undefined> {
    return selectRandomPeer(await this.peers());
  }
}

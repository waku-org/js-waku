import { ConnectionManager } from "@libp2p/interface-connection-manager";
import type { PeerId } from "@libp2p/interface-peer-id";
import type { Peer } from "@libp2p/interface-peer-store";
import type { PeerStore } from "@libp2p/interface-peer-store";
import type {
  Encoder,
  LightPush,
  Message,
  ProtocolOptions,
  SendResult,
} from "@waku/interfaces";
import debug from "debug";
import all from "it-all";
import * as lp from "it-length-prefixed";
import { pipe } from "it-pipe";
import { Uint8ArrayList } from "uint8arraylist";

import { PushResponse } from "../../proto/light_push";
import { DefaultPubSubTopic } from "../constants";
import { selectConnection } from "../select_connection";
import {
  getPeersForProtocol,
  selectPeerForProtocol,
  selectRandomPeer,
} from "../select_peer";

import { PushRPC } from "./push_rpc";

const log = debug("waku:light-push");

export const LightPushCodec = "/vac/waku/lightpush/2.0.0-beta1";
export { PushResponse };

export interface LightPushComponents {
  peerStore: PeerStore;
  connectionManager: ConnectionManager;
}

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

/**
 * Implements the [Waku v2 Light Push protocol](https://rfc.vac.dev/spec/19/).
 */
class WakuLightPush implements LightPush {
  pubSubTopic: string;

  constructor(public components: LightPushComponents, options?: CreateOptions) {
    this.pubSubTopic = options?.pubSubTopic ?? DefaultPubSubTopic;
  }

  async push(
    encoder: Encoder,
    message: Partial<Message>,
    opts?: ProtocolOptions
  ): Promise<SendResult> {
    const pubSubTopic = opts?.pubSubTopic ? opts.pubSubTopic : this.pubSubTopic;

    const res = await selectPeerForProtocol(
      this.components.peerStore,
      [LightPushCodec],
      opts?.peerId
    );

    if (!res) {
      throw new Error("Failed to get a peer");
    }
    const { peer } = res;

    const connections = this.components.connectionManager.getConnections(
      peer.id
    );
    const connection = selectConnection(connections);

    if (!connection) throw "Failed to get a connection to the peer";

    const stream = await connection.newStream(LightPushCodec);

    const recipients: PeerId[] = [];

    try {
      const protoMessage = await encoder.toProtoObj(message);
      if (!protoMessage) {
        log("Failed to encode to protoMessage, aborting push");
        return { recipients };
      }
      const query = PushRPC.createRequest(protoMessage, pubSubTopic);
      const res = await pipe(
        [query.encode()],
        lp.encode(),
        stream,
        lp.decode(),
        async (source) => await all(source)
      );
      try {
        const bytes = new Uint8ArrayList();
        res.forEach((chunk) => {
          bytes.append(chunk);
        });

        const response = PushRPC.decode(bytes).response;

        if (!response) {
          log("No response in PushRPC");
          return { recipients };
        }

        if (response.isSuccess) {
          recipients.push(peer.id);
        }
      } catch (err) {
        log("Failed to decode push reply", err);
      }
    } catch (err) {
      log("Failed to send waku light push request", err);
    }
    return { recipients };
  }

  /**
   * Returns known peers from the address book (`libp2p.peerStore`) that support
   * light push protocol. Waku may or may not be currently connected to these
   * peers.
   */
  async peers(): Promise<Peer[]> {
    return getPeersForProtocol(this.components.peerStore, [LightPushCodec]);
  }

  /**
   * Returns a random peer that supports light push protocol from the address
   * book (`libp2p.peerStore`). Waku may or  may not be currently connected to
   * this peer.
   */
  async randomPeer(): Promise<Peer | undefined> {
    return selectRandomPeer(await this.peers());
  }

  get peerStore(): PeerStore {
    return this.components.peerStore;
  }
}

export function wakuLightPush(
  init: Partial<CreateOptions> = {}
): (components: LightPushComponents) => LightPush {
  return (components: LightPushComponents) =>
    new WakuLightPush(components, init);
}

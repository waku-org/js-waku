import type { Libp2p } from "@libp2p/interface";
import type { PeerId } from "@libp2p/interface/peer-id";
import type { Peer, PeerStore } from "@libp2p/interface/peer-store";
import type { Libp2pOptions } from "libp2p";

import type { IDecodedMessage } from "./message.js";

export enum Protocols {
  Relay = "relay",
  Store = "store",
  LightPush = "lightpush",
  Filter = "filter"
}

export interface IBaseProtocol {
  multicodec: string;
  peerStore: PeerStore;
  peers: () => Promise<Peer[]>;
  addLibp2pEventListener: Libp2p["addEventListener"];
  removeLibp2pEventListener: Libp2p["removeEventListener"];
}

export type ProtocolCreateOptions = {
  /**
   * Waku supports usage of multiple pubsub topics, but this is still in early stages.
   * Waku implements sharding to achieve scalability
   * The format of the sharded topic is `/waku/2/rs/<shard_cluster_index>/<shard_number>`
   * To learn more about the sharding specifications implemented, see [Relay Sharding](https://rfc.vac.dev/spec/51/).
   *
   * If no pubsub topic is specified, the default pubsub topic is used.
   * The set of pubsub topics that are used to initialise the Waku node, will need to be used by the protocols as well
   * You cannot currently add or remove pubsub topics after initialisation.
   * This is used by:
   * - WakuRelay to receive, route and send messages,
   * - WakuLightPush to send messages,
   * - WakuStore to retrieve messages.
   * See [Waku v2 Topic Usage Recommendations](https://rfc.vac.dev/spec/23/) for details.
   *
   */
  pubSubTopics?: string[];
  /**
   * You can pass options to the `Libp2p` instance used by {@link @waku/core.WakuNode} using the `libp2p` property.
   * This property is the same type as the one passed to [`Libp2p.create`](https://github.com/libp2p/js-libp2p/blob/master/doc/API.md#create)
   * apart that we made the `modules` property optional and partial,
   * allowing its omission and letting Waku set good defaults.
   * Notes that some values are overridden by {@link @waku/core.WakuNode} to ensure it implements the Waku protocol.
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
};

export type Callback<T extends IDecodedMessage> = (
  msg: T
) => void | Promise<void>;

export enum SendError {
  GENERIC_FAIL = "Generic error",
  ENCODE_FAILED = "Failed to encode",
  DECODE_FAILED = "Failed to decode",
  SIZE_TOO_BIG = "Size is too big",
  NO_RPC_RESPONSE = "No RPC response",
  TOPIC_NOT_SUBSCRIBED = "Topic not subscribed"
}

export interface SendResult {
  errors?: SendError[];
  recipients: PeerId[];
}

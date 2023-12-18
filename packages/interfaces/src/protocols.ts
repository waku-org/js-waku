import type { Libp2p } from "@libp2p/interface";
import type { PeerId } from "@libp2p/interface/peer-id";
import type { Peer, PeerStore } from "@libp2p/interface/peer-store";

import type { ShardInfo } from "./enr.js";
import type { CreateLibp2pOptions } from "./libp2p.js";
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
   * Waku supports usage of multiple pubsub topics. This is achieved through static sharding for now, and auto-sharding in the future.
   * The format to specify a shard is:
   * clusterId: number, shards: number[]
   * To learn more about the sharding specifications implemented, see [Relay Sharding](https://rfc.vac.dev/spec/51/).
   * The Pubsub Topic to use. Defaults to {@link @waku/core!DefaultPubsubTopic }.
   *
   * If no pubsub topic is specified, the default pubsub topic is used.
   * The set of pubsub topics that are used to initialize the Waku node, will need to be used by the protocols as well
   * You cannot currently add or remove pubsub topics after initialization.
   * This is used by:
   * - WakuRelay to receive, route and send messages,
   * - WakuLightPush to send messages,
   * - WakuStore to retrieve messages.
   * See [Waku v2 Topic Usage Recommendations](https://rfc.vac.dev/spec/23/) for details.
   *
   */
  shardInfo?: ShardInfo;
  /**
   * You can pass options to the `Libp2p` instance used by {@link @waku/core!WakuNode} using the `libp2p` property.
   * This property is the same type as the one passed to [`Libp2p.create`](https://github.com/libp2p/js-libp2p/blob/master/doc/API.md#create)
   * apart that we made the `modules` property optional and partial,
   * allowing its omission and letting Waku set good defaults.
   * Notes that some values are overridden by {@link @waku/core!WakuNode} to ensure it implements the Waku protocol.
   */
  libp2p?: Partial<CreateLibp2pOptions>;
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
  /** Could not determine the origin of the fault. Best to check connectivity and try again */
  GENERIC_FAIL = "Generic error",
  /**
   * Failure to protobuf encode the message. This is not recoverable and needs
   * further investigation.
   */
  ENCODE_FAILED = "Failed to encode",
  /**
   * Failure to protobuf decode the message. May be due to a remote peer issue,
   * ensuring that messages are sent via several peer enable mitigation of this error.
   */
  DECODE_FAILED = "Failed to decode",
  /**
   * The message payload is empty, making the message invalid. Ensure that a non-empty
   * payload is set on the outgoing message.
   */
  EMPTY_PAYLOAD = "Payload is empty",
  /**
   * The message size is above the maximum message size allowed on the Waku Network.
   * Compressing the message or using an alternative strategy for large messages is recommended.
   */
  SIZE_TOO_BIG = "Size is too big",
  /**
   * The PubsubTopic passed to the send function is not configured on the Waku node.
   * Please ensure that the PubsubTopic is used when initializing the Waku node.
   */
  TOPIC_NOT_CONFIGURED = "Topic not configured",
  /**
   * Failure to find a peer with suitable protocols. This may due to a connection issue.
   * Mitigation can be: retrying after a given time period, display connectivity issue
   * to user or listening for `peer:connected:bootstrap` or `peer:connected:peer-exchange`
   * on the connection manager before retrying.
   */
  NO_PEER_AVAILABLE = "No peer available",
  /**
   * The remote peer did not behave as expected. Mitigation for `NO_PEER_AVAILABLE`
   * or `DECODE_FAILED` can be used.
   */
  REMOTE_PEER_FAULT = "Remote peer fault",
  /**
   * The remote peer rejected the message. Information provided by the remote peer
   * is logged. Review message validity, or mitigation for `NO_PEER_AVAILABLE`
   * or `DECODE_FAILED` can be used.
   */
  REMOTE_PEER_REJECTED = "Remote peer rejected"
}

export interface SendResult {
  errors?: SendError[];
  recipients: PeerId[];
}

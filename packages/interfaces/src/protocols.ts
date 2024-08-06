import type { Libp2p } from "@libp2p/interface";
import type { PeerId } from "@libp2p/interface";
import type { Peer, PeerStore } from "@libp2p/interface";

import type { ShardInfo } from "./enr.js";
import type { CreateLibp2pOptions } from "./libp2p.js";
import type { IDecodedMessage } from "./message.js";
import { ThisAndThat, ThisOrThat } from "./misc.js";

export enum Protocols {
  Relay = "relay",
  Store = "store",
  LightPush = "lightpush",
  Filter = "filter"
}

export type IBaseProtocolCore = {
  multicodec: string;
  peerStore: PeerStore;
  allPeers: () => Promise<Peer[]>;
  connectedPeers: () => Promise<Peer[]>;
  addLibp2pEventListener: Libp2p["addEventListener"];
  removeLibp2pEventListener: Libp2p["removeEventListener"];
};

export type IBaseProtocolSDK = {
  readonly connectedPeers: Peer[];
  renewPeer: (peerToDisconnect: PeerId) => Promise<Peer>;
  readonly numPeersToUse: number;
};

export type ContentTopicInfo = {
  clusterId?: number;
  contentTopics: string[];
};

export type NetworkConfig = StaticSharding | AutoSharding;

export type StaticSharding = ShardInfo;
export type AutoSharding = ContentTopicInfo;

//TODO: merge this with ProtocolCreateOptions or establish distinction: https://github.com/waku-org/js-waku/issues/2048
/**
 * Options for using LightPush and Filter
 */
export type ProtocolUseOptions = {
  /**
   * Optional flag to enable auto-retry with exponential backoff
   */
  autoRetry?: boolean;
  /**
   * Optional flag to force using all available peers
   */
  forceUseAllPeers?: boolean;
  /**
   * Optional maximum number of attempts for exponential backoff
   */
  maxAttempts?: number;
  /**
   * Optional initial delay in milliseconds for exponential backoff
   */
  initialDelay?: number;
  /**
   * Optional maximum delay in milliseconds for exponential backoff
   */
  maxDelay?: number;
};

export type ProtocolCreateOptions = {
  /**
   * Configuration for determining the network in use.
   *
   * If using ShardInfo:
   * Default value is configured for The Waku Network.
   * The format to specify a shard is: clusterId: number, shards: number[]
   * To learn more about the sharding specification, see [Relay Sharding](https://rfc.vac.dev/spec/51/).
   *
   * If using Content Topics:
   * See [Waku v2 Topic Usage Recommendations](https://github.com/vacp2p/rfc-index/blob/main/waku/informational/23/topics.md#content-topics) for details.
   * You cannot add or remove content topics after initialization of the node.
   */
  networkConfig?: NetworkConfig;
  /**
   * You can pass options to the `Libp2p` instance used by {@link @waku/sdk!WakuNode} using the `libp2p` property.
   * This property is the same type as the one passed to [`Libp2p.create`](https://github.com/libp2p/js-libp2p/blob/master/doc/API.md#create)
   * apart that we made the `modules` property optional and partial,
   * allowing its omission and letting Waku set good defaults.
   * Notes that some values are overridden by {@link @waku/sdk!WakuNode} to ensure it implements the Waku protocol.
   */
  libp2p?: Partial<CreateLibp2pOptions>;
  /**
   * Number of peers to connect to, for the usage of the protocol.
   * This is used by:
   * - Light Push to send messages,
   * - Filter to retrieve messages.
   * Defaults to 3.
   */
  numPeersToUse?: number;
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
  /**
   * List of peers to use to bootstrap the node. Ignored if defaultBootstrap is set to true.
   */
  bootstrapPeers?: string[];
};

export type Callback<T extends IDecodedMessage> = (
  msg: T
) => void | Promise<void>;

export enum ProtocolError {
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
   * The pubsub topic configured on the decoder does not match the pubsub topic setup on the protocol.
   * Ensure that the pubsub topic used for decoder creation is the same as the one used for protocol.
   */
  TOPIC_DECODER_MISMATCH = "Topic decoder mismatch",
  /**
   * The topics passed in the decoders do not match each other, or don't exist at all.
   * Ensure that all the pubsub topics used in the decoders are valid and match each other.
   */
  INVALID_DECODER_TOPICS = "Invalid decoder topics",
  /**
   * Failure to find a peer with suitable protocols. This may due to a connection issue.
   * Mitigation can be: retrying after a given time period, display connectivity issue
   * to user or listening for `peer:connected:bootstrap` or `peer:connected:peer-exchange`
   * on the connection manager before retrying.
   */
  NO_PEER_AVAILABLE = "No peer available",
  /**
   * Failure to find a stream to the peer. This may be because the connection with the peer is not still alive.
   * Mitigation can be: retrying after a given time period, or mitigation for `NO_PEER_AVAILABLE` can be used.
   */
  NO_STREAM_AVAILABLE = "No stream available",
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
  REMOTE_PEER_REJECTED = "Remote peer rejected",
  /**
   * The protocol request timed out without a response. This may be due to a connection issue.
   * Mitigation can be: retrying after a given time period
   */
  REQUEST_TIMEOUT = "Request timeout"
}

export interface Failure {
  error: ProtocolError;
  peerId?: PeerId;
}

export type CoreProtocolResult = ThisOrThat<
  "success",
  PeerId,
  "failure",
  Failure
>;

export type SDKProtocolResult = ThisAndThat<
  "successes",
  PeerId[],
  "failures",
  Failure[]
>;

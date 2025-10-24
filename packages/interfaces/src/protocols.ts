import type { PeerId } from "@libp2p/interface";

import type { ConnectionManagerOptions } from "./connection_manager.js";
import type { DiscoveryOptions, PeerCache } from "./discovery.js";
import type { FilterProtocolOptions } from "./filter.js";
import type { CreateLibp2pOptions } from "./libp2p.js";
import type { LightPushProtocolOptions } from "./light_push.js";
import type { IDecodedMessage, IProtoMessage } from "./message.js";
import type { ThisAndThat, ThisOrThat } from "./misc.js";
import { NetworkConfig } from "./sharding.js";
import type { StoreProtocolOptions } from "./store.js";

export enum Protocols {
  Relay = "relay",
  Store = "store",
  LightPush = "lightpush",
  Filter = "filter"
}

export type CreateNodeOptions = {
  /**
   * Set the user agent string to be used in identification of the node.
   *
   * @default "js-waku"
   */
  userAgent?: string;

  /**
   * Starts Waku node automatically upon creations.
   * Calls {@link @waku/sdk!WakuNode.start} before returning {@link @waku/sdk!WakuNode}
   *
   * @default true
   */
  autoStart?: boolean;

  /**
   * Configuration for determining the network in use.
   * Network configuration refers to the shards and clusters used in the network.
   *
   * If using Static Sharding:
   * Cluster ID and shards are specified in the format: clusterId: number, shards: number[]
   * The default value is configured for The Waku Network => clusterId: 0, shards: [0, 1, 2, 3, 4, 5, 6, 7]
   * To learn more about the sharding specification, see [Relay Sharding](https://rfc.vac.dev/spec/51/).
   *
   * If using Auto Sharding:
   * Cluster ID and content topics are specified in the format: clusterId: number, contentTopics: string[]
   * Content topics are used to determine the shards to be configured for the network.
   * Cluster ID is optional, and defaults to The Waku Network's cluster ID => 0
   * To specify content topics, see [Waku v2 Topic Usage Recommendations](https://github.com/vacp2p/rfc-index/blob/main/waku/informational/23/topics.md#content-topics) for details
   *
   * @default { clusterId: 1, shards: [0, 1, 2, 3, 4, 5, 6, 7] }
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
   * This is used by Filter to retrieve messages.
   *
   * @default 2.
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
   * Enable or disable specific discovery methods.
   *
   * @default { peerExchange: true, dns: true, peerCache: true }
   */
  discovery?: Partial<DiscoveryOptions>;

  /**
   * Peer cache to use for storing and retrieving peer information.
   * If present, enables peer cache discovery.
   *
   * @default browser's localStorage
   */
  peerCache?: PeerCache;

  /**
   * List of peers to use to bootstrap the node. Ignored if defaultBootstrap is set to true.
   */
  bootstrapPeers?: string[];

  /**
   * Configuration for connection manager.
   * If not specified - default values are applied.
   */
  connectionManager?: Partial<ConnectionManagerOptions>;

  /**
   * Configuration for Filter protocol.
   * If not specified - default values are applied.
   */
  filter?: Partial<FilterProtocolOptions>;

  /**
   * Options for the Store protocol.
   * If not specified - default values are applied.
   */
  store?: Partial<StoreProtocolOptions>;

  /**
   * Options for the LightPush protocol.
   * If not specified - default values are applied.
   */
  lightPush?: Partial<LightPushProtocolOptions>;
};

export type Callback<T extends IDecodedMessage> = (
  msg: T
) => void | Promise<void>;

export enum LightPushError {
  GENERIC_FAIL = "Generic error",
  DECODE_FAILED = "Failed to decode",
  NO_PEER_AVAILABLE = "No peer available",
  NO_STREAM_AVAILABLE = "No stream available",
  NO_RESPONSE = "No response received",
  STREAM_ABORTED = "Stream aborted",

  ENCODE_FAILED = "Failed to encode",
  EMPTY_PAYLOAD = "Payload is empty",
  SIZE_TOO_BIG = "Size is too big",
  TOPIC_NOT_CONFIGURED = "Topic not configured",
  RLN_PROOF_GENERATION = "Proof generation failed",
  REMOTE_PEER_REJECTED = "Remote peer rejected",

  BAD_REQUEST = "Bad request format",
  PAYLOAD_TOO_LARGE = "Message payload exceeds maximum size",
  INVALID_MESSAGE = "Message validation failed",
  UNSUPPORTED_TOPIC = "Unsupported pubsub topic",
  TOO_MANY_REQUESTS = "Rate limit exceeded",
  INTERNAL_ERROR = "Internal server error",
  UNAVAILABLE = "Service temporarily unavailable",
  NO_RLN_PROOF = "RLN proof generation failed",
  NO_PEERS = "No relay peers available"
}

export enum FilterError {
  // General errors
  GENERIC_FAIL = "Generic error",
  DECODE_FAILED = "Failed to decode",
  NO_PEER_AVAILABLE = "No peer available",
  NO_STREAM_AVAILABLE = "No stream available",
  NO_RESPONSE = "No response received",
  STREAM_ABORTED = "Stream aborted",

  // Filter specific errors
  REMOTE_PEER_REJECTED = "Remote peer rejected",
  TOPIC_NOT_CONFIGURED = "Topic not configured",
  SUBSCRIPTION_FAILED = "Subscription failed",
  UNSUBSCRIBE_FAILED = "Unsubscribe failed",
  PING_FAILED = "Ping failed",
  TOPIC_DECODER_MISMATCH = "Topic decoder mismatch",
  INVALID_DECODER_TOPICS = "Invalid decoder topics",
  SUBSCRIPTION_LIMIT_EXCEEDED = "Subscription limit exceeded",
  INVALID_CONTENT_TOPIC = "Invalid content topic",
  PUSH_MESSAGE_FAILED = "Push message failed",
  EMPTY_MESSAGE = "Empty message received",
  MISSING_PUBSUB_TOPIC = "Pubsub topic missing from push message"
}

export interface LightPushFailure {
  error: LightPushError;
  peerId?: PeerId;
}

export interface FilterFailure {
  error: FilterError;
  peerId?: PeerId;
}

export type LightPushCoreResult = ThisOrThat<
  "success",
  PeerId,
  "failure",
  LightPushFailure
> & {
  /**
   * The proto object of the message.
   * Present only if the message was successfully pushed to the network.
   */
  message?: IProtoMessage;
};

export type FilterCoreResult = ThisOrThat<
  "success",
  PeerId,
  "failure",
  FilterFailure
>;

export type LightPushSDKResult = ThisAndThat<
  "successes",
  PeerId[],
  "failures",
  LightPushFailure[]
> & {
  /**
   * The proto objects of the messages.
   * Present only if the messages were successfully pushed to the network.
   */
  messages?: IProtoMessage[];
};

export type FilterSDKResult = ThisAndThat<
  "successes",
  PeerId[],
  "failures",
  FilterFailure[]
>;

/**
 * @deprecated replace usage by specific result types
 */
export type SDKProtocolResult = ThisAndThat<
  "successes",
  PeerId[],
  "failures",
  Array<{
    error: ProtocolError;
    peerId?: PeerId;
  }>
>;

/**
 * @deprecated replace usage by specific result types
 */
export enum ProtocolError {
  GENERIC_FAIL = "Generic error",
  REMOTE_PEER_REJECTED = "Remote peer rejected",
  DECODE_FAILED = "Failed to decode",
  NO_PEER_AVAILABLE = "No peer available",
  NO_STREAM_AVAILABLE = "No stream available",
  NO_RESPONSE = "No response received",
  ENCODE_FAILED = "Failed to encode",
  EMPTY_PAYLOAD = "Payload is empty",
  SIZE_TOO_BIG = "Size is too big",
  TOPIC_NOT_CONFIGURED = "Topic not configured",
  STREAM_ABORTED = "Stream aborted",
  RLN_PROOF_GENERATION = "Proof generation failed",
  TOPIC_DECODER_MISMATCH = "Topic decoder mismatch",
  INVALID_DECODER_TOPICS = "Invalid decoder topics"
}

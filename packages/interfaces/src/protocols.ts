import type { PeerId } from "@libp2p/interface";

import type { ConnectionManagerOptions } from "./connection_manager.js";
import type { FilterProtocolOptions } from "./filter.js";
import type { CreateLibp2pOptions } from "./libp2p.js";
import type { LightPushProtocolOptions } from "./light_push.js";
import type { IDecodedMessage } from "./message.js";
import type { ThisAndThat, ThisOrThat } from "./misc.js";
import type { AutoSharding, StaticSharding } from "./sharding.js";
import type { StoreProtocolOptions } from "./store.js";

export enum Protocols {
  Relay = "relay",
  Store = "store",
  LightPush = "lightpush",
  Filter = "filter"
}

export type NetworkConfig = StaticSharding | AutoSharding;

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
   * @default { peerExchange: true, dns: true, localPeerCache: true }
   */
  discovery?: {
    peerExchange: boolean;
    dns: boolean;
    localPeerCache: boolean;
  };

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

export enum ProtocolError {
  //
  // GENERAL ERRORS SECTION
  //
  /**
   * Could not determine the origin of the fault. Best to check connectivity and try again
   * */
  GENERIC_FAIL = "Generic error",

  /**
   * The remote peer rejected the message. Information provided by the remote peer
   * is logged. Review message validity, or mitigation for `NO_PEER_AVAILABLE`
   * or `DECODE_FAILED` can be used.
   */
  REMOTE_PEER_REJECTED = "Remote peer rejected",

  /**
   * Failure to protobuf decode the message. May be due to a remote peer issue,
   * ensuring that messages are sent via several peer enable mitigation of this error.
   */
  DECODE_FAILED = "Failed to decode",

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
  NO_RESPONSE = "No response received",

  //
  // SEND ERRORS SECTION
  //
  /**
   * Failure to protobuf encode the message. This is not recoverable and needs
   * further investigation.
   */
  ENCODE_FAILED = "Failed to encode",

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
   * Fails when
   */
  STREAM_ABORTED = "Stream aborted",

  /**
   * General proof generation error message.
   * nwaku: https://github.com/waku-org/nwaku/blob/c3cb06ac6c03f0f382d3941ea53b330f6a8dd127/waku/waku_rln_relay/group_manager/group_manager_base.nim#L201C19-L201C42
   */
  RLN_PROOF_GENERATION = "Proof generation failed",

  //
  // RECEIVE ERRORS SECTION
  //
  /**
   * The pubsub topic configured on the decoder does not match the pubsub topic setup on the protocol.
   * Ensure that the pubsub topic used for decoder creation is the same as the one used for protocol.
   */
  TOPIC_DECODER_MISMATCH = "Topic decoder mismatch",

  /**
   * The topics passed in the decoders do not match each other, or don't exist at all.
   * Ensure that all the pubsub topics used in the decoders are valid and match each other.
   */
  INVALID_DECODER_TOPICS = "Invalid decoder topics"
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

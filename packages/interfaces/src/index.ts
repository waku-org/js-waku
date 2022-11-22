import type { GossipSub } from "@chainsafe/libp2p-gossipsub";
import type { Stream } from "@libp2p/interface-connection";
import type { PeerId } from "@libp2p/interface-peer-id";
import type { Peer } from "@libp2p/interface-peer-store";
import type { PeerStore } from "@libp2p/interface-peer-store";
import type { Multiaddr } from "@multiformats/multiaddr";
import type { Libp2p } from "libp2p";

export enum Protocols {
  Relay = "relay",
  Store = "store",
  LightPush = "lightpush",
  Filter = "filter",
}

export interface PointToPointProtocol {
  peerStore: PeerStore;
  peers: () => Promise<Peer[]>;
}
export interface Index {
  digest?: Uint8Array;
  receivedTime?: bigint;
  senderTime?: bigint;
  pubsubTopic?: string;
}

export type ProtocolOptions = {
  pubSubTopic?: string;
  /**
   * Optionally specify an PeerId for the protocol request. If not included, will use a random peer.
   */
  peerId?: PeerId;
};

export type Callback<T extends Message> = (msg: T) => void | Promise<void>;

export interface Filter extends PointToPointProtocol {
  subscribe: <T extends DecodedMessage>(
    decoders: Decoder<T>[],
    callback: Callback<T>,
    opts?: ProtocolOptions
  ) => Promise<() => Promise<void>>;
}

export interface LightPush extends PointToPointProtocol {
  push: (
    encoder: Encoder,
    message: Message,
    opts?: ProtocolOptions
  ) => Promise<SendResult>;
}

export enum PageDirection {
  BACKWARD = "backward",
  FORWARD = "forward",
}

export interface TimeFilter {
  startTime: Date;
  endTime: Date;
}

export type Cursor = {
  digest?: Uint8Array;
  senderTime?: bigint;
  pubsubTopic?: string;
};

export type StoreQueryOptions = {
  /**
   * The direction in which pages are retrieved:
   * - { @link PageDirection.BACKWARD }: Most recent page first.
   * - { @link PageDirection.FORWARD }: Oldest page first.
   *
   * Note: This does not affect the ordering of messages with the page
   * (the oldest message is always first).
   *
   * @default { @link PageDirection.BACKWARD }
   */
  pageDirection?: PageDirection;
  /**
   * The number of message per page.
   */
  pageSize?: number;
  /**
   * Retrieve messages with a timestamp within the provided values.
   */
  timeFilter?: TimeFilter;
  /**
   * Cursor as an index to start a query from.
   */
  cursor?: Cursor;
} & ProtocolOptions;

export interface Store extends PointToPointProtocol {
  queryOrderedCallback: <T extends DecodedMessage>(
    decoders: Decoder<T>[],
    callback: (message: T) => Promise<void | boolean> | boolean | void,
    options?: StoreQueryOptions
  ) => Promise<void>;
  queryCallbackOnPromise: <T extends DecodedMessage>(
    decoders: Decoder<T>[],
    callback: (
      message: Promise<T | undefined>
    ) => Promise<void | boolean> | boolean | void,
    options?: StoreQueryOptions
  ) => Promise<void>;
  queryGenerator: <T extends DecodedMessage>(
    decoders: Decoder<T>[],
    options?: StoreQueryOptions
  ) => AsyncGenerator<Promise<T | undefined>[]>;
}

export interface Relay extends GossipSub {
  send: (encoder: Encoder, message: Message) => Promise<SendResult>;
  addObserver: <T extends DecodedMessage>(
    decoder: Decoder<T>,
    callback: Callback<T>
  ) => () => void;
  getMeshPeers: () => string[];
}

export interface Waku {
  libp2p: Libp2p;
  relay?: Relay;
  store?: Store;
  filter?: Filter;
  lightPush?: LightPush;

  dial(peer: PeerId | Multiaddr, protocols?: Protocols[]): Promise<Stream>;

  start(): Promise<void>;

  stop(): Promise<void>;

  isStarted(): boolean;
}

export interface WakuLight extends Waku {
  relay: undefined;
  store: Store;
  filter: Filter;
  lightPush: LightPush;
}

export interface WakuPrivacy extends Waku {
  relay: Relay;
  store: undefined;
  filter: undefined;
  lightPush: undefined;
}

export interface WakuFull extends Waku {
  relay: Relay;
  store: Store;
  filter: Filter;
  lightPush: LightPush;
}

export interface RateLimitProof {
  proof: Uint8Array;
  merkleRoot: Uint8Array;
  epoch: Uint8Array;
  shareX: Uint8Array;
  shareY: Uint8Array;
  nullifier: Uint8Array;
  rlnIdentifier: Uint8Array;
}

/**
 * Interface matching the protobuf library.
 * Field types matches the protobuf type over the wire
 */
export interface ProtoMessage {
  payload: Uint8Array | undefined;
  contentTopic: string | undefined;
  version: number | undefined;
  timestamp: bigint | undefined;
  rateLimitProof: RateLimitProof | undefined;
  ephemeral: boolean | undefined;
}

/**
 * Interface for messages to encode and send.
 */
export interface Message {
  payload?: Uint8Array;
  timestamp?: Date;
  rateLimitProof?: RateLimitProof;
}

export interface Encoder {
  contentTopic: string;
  ephemeral: boolean;
  toWire: (message: Message) => Promise<Uint8Array | undefined>;
  toProtoObj: (message: Message) => Promise<ProtoMessage | undefined>;
}

export interface DecodedMessage {
  payload: Uint8Array | undefined;
  contentTopic: string | undefined;
  timestamp: Date | undefined;
  rateLimitProof: RateLimitProof | undefined;
  ephemeral: boolean | undefined;
}

export interface Decoder<T extends DecodedMessage> {
  contentTopic: string;
  fromWireToProtoObj: (bytes: Uint8Array) => Promise<ProtoMessage | undefined>;
  fromProtoObj: (proto: ProtoMessage) => Promise<T | undefined>;
}

export interface SendResult {
  recipients: PeerId[];
}

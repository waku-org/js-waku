import type { Stream } from "@libp2p/interface-connection";
import type { PeerId } from "@libp2p/interface-peer-id";
import type { Multiaddr } from "@multiformats/multiaddr";
import type { Libp2p } from "libp2p";

export enum Protocols {
  Relay = "relay",
  Store = "store",
  LightPush = "lightpush",
  Filter = "filter",
}

export type ProtocolOptions = {
  pubsubTopic?: string;
  /**
   * Optionally specify an PeerId for the protocol request. If not included, will use a random peer.
   */
  peerId?: PeerId;
};

export type Callback<T extends Message> = (msg: T) => void | Promise<void>;

export interface Filter {
  subscribe: <T extends Message>(
    decoders: Decoder<T>[],
    callback: Callback<T>,
    opts?: ProtocolOptions
  ) => Promise<() => Promise<void>>;
}

export interface LightPush {
  push: (
    encoder: Encoder,
    message: Partial<Message>,
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
   *
   * @default { @link DefaultPageSize }
   */
  pageSize?: number;
  /**
   * Retrieve messages with a timestamp within the provided values.
   */
  timeFilter?: TimeFilter;
} & ProtocolOptions;

export interface Store {
  queryOrderedCallback: <T extends Message>(
    decoders: Decoder<T>[],
    callback: (message: T) => Promise<void | boolean> | boolean | void,
    options?: StoreQueryOptions
  ) => Promise<void>;
  queryCallbackOnPromise: <T extends Message>(
    decoders: Decoder<T>[],
    callback: (
      message: Promise<T | undefined>
    ) => Promise<void | boolean> | boolean | void,
    options?: StoreQueryOptions
  ) => Promise<void>;
  queryGenerator: <T extends Message>(
    decoders: Decoder<T>[],
    options?: StoreQueryOptions
  ) => AsyncGenerator<Promise<T | undefined>[]>;
}

export interface Relay {
  send: (encoder: Encoder, message: Partial<Message>) => Promise<SendResult>;
  addObserver: <T extends Message>(
    decoder: Decoder<T>,
    callback: Callback<T>
  ) => () => void;
}

export interface Waku {
  libp2p: Libp2p;
  relay?: Relay;
  store?: Store;
  filter?: Filter;
  lightPush?: LightPush;

  dial(peer: PeerId | Multiaddr, protocols?: Protocols[]): Promise<Stream>;

  addPeerToAddressBook(
    peerId: PeerId | string,
    multiaddrs: Multiaddr[] | string[]
  ): void;

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

export interface ProtoMessage {
  payload: Uint8Array | undefined;
  contentTopic: string | undefined;
  version: number | undefined;
  timestamp: bigint | undefined;
  rateLimitProof: RateLimitProof | undefined;
}

export interface Message {
  payload: Uint8Array | undefined;
  contentTopic: string | undefined;
  timestamp: Date | undefined;
  rateLimitProof: RateLimitProof | undefined;
}

export interface Encoder {
  contentTopic: string;
  toWire: (message: Partial<Message>) => Promise<Uint8Array | undefined>;
  toProtoObj: (message: Partial<Message>) => Promise<ProtoMessage | undefined>;
}

export interface Decoder<T extends Message> {
  contentTopic: string;
  fromWireToProtoObj: (bytes: Uint8Array) => Promise<ProtoMessage | undefined>;
  fromProtoObj: (proto: ProtoMessage) => Promise<T | undefined>;
}

export interface SendResult {
  recipients: PeerId[];
}

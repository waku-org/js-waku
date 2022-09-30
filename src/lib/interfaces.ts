import type { Stream } from "@libp2p/interface-connection";
import type { PeerId } from "@libp2p/interface-peer-id";
import type { Multiaddr } from "@multiformats/multiaddr";
import type { Libp2p } from "libp2p";

import type { Protocols } from "./waku";
import type { WakuFilter } from "./waku_filter";
import type { WakuLightPush } from "./waku_light_push";
import type { WakuRelay } from "./waku_relay";
import type { WakuStore } from "./waku_store";

export interface Waku {
  libp2p: Libp2p;
  relay?: WakuRelay;
  store?: WakuStore;
  filter?: WakuFilter;
  lightPush?: WakuLightPush;

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
  store: WakuStore;
  filter: WakuFilter;
  lightPush: WakuLightPush;
}

export interface WakuPrivacy extends Waku {
  relay: WakuRelay;
  store: undefined;
  filter: undefined;
  lightPush: undefined;
}

export interface WakuFull extends Waku {
  relay: WakuRelay;
  store: WakuStore;
  filter: WakuFilter;
  lightPush: WakuLightPush;
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

import type { ContentTopic, PubsubTopic } from "./misc.js";
import type { IRoutingInfo } from "./sharding.js";

export interface IRateLimitProof {
  proof: Uint8Array;
  merkleRoot: Uint8Array;
  epoch: Uint8Array;
  shareX: Uint8Array;
  shareY: Uint8Array;
  nullifier: Uint8Array;
  rlnIdentifier: Uint8Array;
}

export interface IDecodedMessage {
  version: number;
  payload: Uint8Array;
  contentTopic: ContentTopic;
  pubsubTopic: PubsubTopic;
  timestamp: Date | undefined;
  rateLimitProof: IRateLimitProof | undefined;
  ephemeral: boolean | undefined;
  meta: Uint8Array | undefined;
}

export interface IRlnMessage extends IDecodedMessage {
  epoch: number | undefined;
  verify(roots: Uint8Array[]): boolean | undefined;
  verifyNoRoot(): boolean | undefined;
}

export interface IEncryptedMessage extends IDecodedMessage {
  signature?: Uint8Array;
  signaturePublicKey?: Uint8Array;
  verifySignature(publicKey: Uint8Array): boolean;
}

export interface ITopicOnlyMessage extends IDecodedMessage {
  payload: Uint8Array;
  contentTopic: ContentTopic;
  pubsubTopic: PubsubTopic;
  timestamp: undefined;
  rateLimitProof: undefined;
  ephemeral: undefined;
  meta: undefined;
}

/**
 * Interface matching the protobuf library.
 * Field types matches the protobuf type over the wire
 */
export interface IProtoMessage {
  payload: Uint8Array;
  contentTopic: string;
  version: number | undefined;
  timestamp: bigint | undefined;
  meta: Uint8Array | undefined;
  rateLimitProof: IRateLimitProof | undefined;
  ephemeral: boolean | undefined;
}

/**
 * Interface for messages to encode and send.
 */
export interface IMessage {
  payload: Uint8Array;
  timestamp?: Date;
  rateLimitProof?: IRateLimitProof;
}

export interface IMetaSetter {
  (message: IProtoMessage & { meta: undefined }): Uint8Array;
}

export interface IEncoder {
  contentTopic: string;
  ephemeral: boolean;
  routingInfo: IRoutingInfo;
  toWire: (message: IMessage) => Promise<Uint8Array | undefined>;
  toProtoObj: (message: IMessage) => Promise<IProtoMessage | undefined>;
}

export interface IDecoder<T extends IDecodedMessage> {
  contentTopic: string;
  routingInfo: IRoutingInfo;
  fromWireToProtoObj: (bytes: Uint8Array) => Promise<IProtoMessage | undefined>;
  fromProtoObj: (
    pubsubTopic: string,
    proto: IProtoMessage
  ) => Promise<T | undefined>;
}

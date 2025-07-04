import type { ContentTopic, PubsubTopic } from "./misc.js";

export interface SingleShardInfo {
  clusterId: number;
  /**
   * TODO: make shard required
   * Specifying this field indicates to the encoder/decoder that static sharding must be used.
   */
  shard?: number;
}

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

export interface EncoderOptions {
  /**
   * @deprecated
   */
  pubsubTopic?: PubsubTopic;
  pubsubTopicShardInfo?: SingleShardInfo;
  /** The content topic to set on outgoing messages. */
  contentTopic: string;
  /**
   * An optional flag to mark message as ephemeral, i.e., not to be stored by Waku Store nodes.
   * @defaultValue `false`
   */
  ephemeral?: boolean;
  /**
   * A function called when encoding messages to set the meta field.
   * @param IProtoMessage The message encoded for wire, without the meta field.
   * If encryption is used, `metaSetter` only accesses _encrypted_ payload.
   */
  metaSetter?: IMetaSetter;
}

export interface IEncoder {
  pubsubTopic: PubsubTopic;
  contentTopic: string;
  ephemeral: boolean;
  toWire: (message: IMessage) => Promise<Uint8Array | undefined>;
  toProtoObj: (message: IMessage) => Promise<IProtoMessage | undefined>;
}

export interface IDecoder<T extends IDecodedMessage> {
  pubsubTopic: PubsubTopic;
  contentTopic: string;
  fromWireToProtoObj: (bytes: Uint8Array) => Promise<IProtoMessage | undefined>;
  fromProtoObj: (
    pubsubTopic: string,
    proto: IProtoMessage
  ) => Promise<T | undefined>;
}

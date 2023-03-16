import type { proto_message } from "@waku/proto";

export interface IRateLimitProof {
  proof: Uint8Array;
  merkleRoot: Uint8Array;
  epoch: Uint8Array;
  shareX: Uint8Array;
  shareY: Uint8Array;
  nullifier: Uint8Array;
  rlnIdentifier: Uint8Array;
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
  (message: proto_message.WakuMessage & { meta: undefined }): Uint8Array;
}

export interface EncoderOptions {
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
  contentTopic: string;
  ephemeral: boolean;
  toWire: (message: IMessage) => Promise<Uint8Array | undefined>;
  toProtoObj: (
    message: IMessage
  ) => Promise<proto_message.WakuMessage | undefined>;
}

export interface IDecodedMessage {
  payload: Uint8Array;
  contentTopic: string;
  pubSubTopic: string;
  timestamp: Date | undefined;
  rateLimitProof: IRateLimitProof | undefined;
  ephemeral: boolean | undefined;
}

export interface IDecoder<T extends IDecodedMessage> {
  contentTopic: string;
  fromWireToProtoObj: (
    bytes: Uint8Array
  ) => Promise<proto_message.WakuMessage | undefined>;
  fromProtoObj: (
    pubSubTopic: string,
    proto: proto_message.WakuMessage
  ) => Promise<T | undefined>;
}

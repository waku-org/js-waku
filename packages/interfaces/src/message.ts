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
 * Interface matching the protobuf library.
 * Field types matches the protobuf type over the wire
 */
export interface IProtoMessage {
  payload?: Uint8Array;
  contentTopic?: string;
  version?: number;
  timestamp?: bigint;
  rateLimitProof?: IRateLimitProof;
  ephemeral?: boolean;
}

/**
 * Interface for messages to encode and send.
 */
export interface IMessage {
  payload?: Uint8Array;
  timestamp?: Date;
  rateLimitProof?: IRateLimitProof;
}

export interface IEncoder {
  contentTopic: string;
  ephemeral: boolean;
  toWire: (message: IMessage) => Promise<Uint8Array | undefined>;
  toProtoObj: (message: IMessage) => Promise<IProtoMessage | undefined>;
}

export interface IDecodedMessage {
  payload: Uint8Array | undefined;
  contentTopic: string | undefined;
  timestamp: Date | undefined;
  rateLimitProof: IRateLimitProof | undefined;
  ephemeral: boolean | undefined;
}

export interface IDecoder<T extends IDecodedMessage> {
  contentTopic: string;
  fromWireToProtoObj: (bytes: Uint8Array) => Promise<IProtoMessage | undefined>;
  fromProtoObj: (proto: IProtoMessage) => Promise<T | undefined>;
}

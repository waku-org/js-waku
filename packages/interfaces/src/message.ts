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

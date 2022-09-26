/* eslint-disable import/export */
/* eslint-disable @typescript-eslint/no-namespace */

import { encodeMessage, decodeMessage, message } from "protons-runtime";
import type { Uint8ArrayList } from "uint8arraylist";
import type { Codec } from "protons-runtime";

export interface PushRequest {
  pubSubTopic?: string;
  message?: WakuMessage;
}

export namespace PushRequest {
  let _codec: Codec<PushRequest>;

  export const codec = (): Codec<PushRequest> => {
    if (_codec == null) {
      _codec = message<PushRequest>(
        (obj, writer, opts = {}) => {
          if (opts.lengthDelimited !== false) {
            writer.fork();
          }

          if (obj.pubSubTopic != null) {
            writer.uint32(10);
            writer.string(obj.pubSubTopic);
          }

          if (obj.message != null) {
            writer.uint32(18);
            WakuMessage.codec().encode(obj.message, writer);
          }

          if (opts.lengthDelimited !== false) {
            writer.ldelim();
          }
        },
        (reader, length) => {
          const obj: any = {};

          const end = length == null ? reader.len : reader.pos + length;

          while (reader.pos < end) {
            const tag = reader.uint32();

            switch (tag >>> 3) {
              case 1:
                obj.pubSubTopic = reader.string();
                break;
              case 2:
                obj.message = WakuMessage.codec().decode(
                  reader,
                  reader.uint32()
                );
                break;
              default:
                reader.skipType(tag & 7);
                break;
            }
          }

          return obj;
        }
      );
    }

    return _codec;
  };

  export const encode = (obj: PushRequest): Uint8Array => {
    return encodeMessage(obj, PushRequest.codec());
  };

  export const decode = (buf: Uint8Array | Uint8ArrayList): PushRequest => {
    return decodeMessage(buf, PushRequest.codec());
  };
}

export interface PushResponse {
  isSuccess?: boolean;
  info?: string;
}

export namespace PushResponse {
  let _codec: Codec<PushResponse>;

  export const codec = (): Codec<PushResponse> => {
    if (_codec == null) {
      _codec = message<PushResponse>(
        (obj, writer, opts = {}) => {
          if (opts.lengthDelimited !== false) {
            writer.fork();
          }

          if (obj.isSuccess != null) {
            writer.uint32(8);
            writer.bool(obj.isSuccess);
          }

          if (obj.info != null) {
            writer.uint32(18);
            writer.string(obj.info);
          }

          if (opts.lengthDelimited !== false) {
            writer.ldelim();
          }
        },
        (reader, length) => {
          const obj: any = {};

          const end = length == null ? reader.len : reader.pos + length;

          while (reader.pos < end) {
            const tag = reader.uint32();

            switch (tag >>> 3) {
              case 1:
                obj.isSuccess = reader.bool();
                break;
              case 2:
                obj.info = reader.string();
                break;
              default:
                reader.skipType(tag & 7);
                break;
            }
          }

          return obj;
        }
      );
    }

    return _codec;
  };

  export const encode = (obj: PushResponse): Uint8Array => {
    return encodeMessage(obj, PushResponse.codec());
  };

  export const decode = (buf: Uint8Array | Uint8ArrayList): PushResponse => {
    return decodeMessage(buf, PushResponse.codec());
  };
}

export interface PushRPC {
  requestId?: string;
  request?: PushRequest;
  response?: PushResponse;
}

export namespace PushRPC {
  let _codec: Codec<PushRPC>;

  export const codec = (): Codec<PushRPC> => {
    if (_codec == null) {
      _codec = message<PushRPC>(
        (obj, writer, opts = {}) => {
          if (opts.lengthDelimited !== false) {
            writer.fork();
          }

          if (obj.requestId != null) {
            writer.uint32(10);
            writer.string(obj.requestId);
          }

          if (obj.request != null) {
            writer.uint32(18);
            PushRequest.codec().encode(obj.request, writer);
          }

          if (obj.response != null) {
            writer.uint32(26);
            PushResponse.codec().encode(obj.response, writer);
          }

          if (opts.lengthDelimited !== false) {
            writer.ldelim();
          }
        },
        (reader, length) => {
          const obj: any = {};

          const end = length == null ? reader.len : reader.pos + length;

          while (reader.pos < end) {
            const tag = reader.uint32();

            switch (tag >>> 3) {
              case 1:
                obj.requestId = reader.string();
                break;
              case 2:
                obj.request = PushRequest.codec().decode(
                  reader,
                  reader.uint32()
                );
                break;
              case 3:
                obj.response = PushResponse.codec().decode(
                  reader,
                  reader.uint32()
                );
                break;
              default:
                reader.skipType(tag & 7);
                break;
            }
          }

          return obj;
        }
      );
    }

    return _codec;
  };

  export const encode = (obj: PushRPC): Uint8Array => {
    return encodeMessage(obj, PushRPC.codec());
  };

  export const decode = (buf: Uint8Array | Uint8ArrayList): PushRPC => {
    return decodeMessage(buf, PushRPC.codec());
  };
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

export namespace RateLimitProof {
  let _codec: Codec<RateLimitProof>;

  export const codec = (): Codec<RateLimitProof> => {
    if (_codec == null) {
      _codec = message<RateLimitProof>(
        (obj, writer, opts = {}) => {
          if (opts.lengthDelimited !== false) {
            writer.fork();
          }

          if (obj.proof != null) {
            writer.uint32(10);
            writer.bytes(obj.proof);
          } else {
            throw new Error(
              'Protocol error: required field "proof" was not found in object'
            );
          }

          if (obj.merkleRoot != null) {
            writer.uint32(18);
            writer.bytes(obj.merkleRoot);
          } else {
            throw new Error(
              'Protocol error: required field "merkleRoot" was not found in object'
            );
          }

          if (obj.epoch != null) {
            writer.uint32(26);
            writer.bytes(obj.epoch);
          } else {
            throw new Error(
              'Protocol error: required field "epoch" was not found in object'
            );
          }

          if (obj.shareX != null) {
            writer.uint32(34);
            writer.bytes(obj.shareX);
          } else {
            throw new Error(
              'Protocol error: required field "shareX" was not found in object'
            );
          }

          if (obj.shareY != null) {
            writer.uint32(42);
            writer.bytes(obj.shareY);
          } else {
            throw new Error(
              'Protocol error: required field "shareY" was not found in object'
            );
          }

          if (obj.nullifier != null) {
            writer.uint32(50);
            writer.bytes(obj.nullifier);
          } else {
            throw new Error(
              'Protocol error: required field "nullifier" was not found in object'
            );
          }

          if (obj.rlnIdentifier != null) {
            writer.uint32(58);
            writer.bytes(obj.rlnIdentifier);
          } else {
            throw new Error(
              'Protocol error: required field "rlnIdentifier" was not found in object'
            );
          }

          if (opts.lengthDelimited !== false) {
            writer.ldelim();
          }
        },
        (reader, length) => {
          const obj: any = {
            proof: new Uint8Array(0),
            merkleRoot: new Uint8Array(0),
            epoch: new Uint8Array(0),
            shareX: new Uint8Array(0),
            shareY: new Uint8Array(0),
            nullifier: new Uint8Array(0),
            rlnIdentifier: new Uint8Array(0),
          };

          const end = length == null ? reader.len : reader.pos + length;

          while (reader.pos < end) {
            const tag = reader.uint32();

            switch (tag >>> 3) {
              case 1:
                obj.proof = reader.bytes();
                break;
              case 2:
                obj.merkleRoot = reader.bytes();
                break;
              case 3:
                obj.epoch = reader.bytes();
                break;
              case 4:
                obj.shareX = reader.bytes();
                break;
              case 5:
                obj.shareY = reader.bytes();
                break;
              case 6:
                obj.nullifier = reader.bytes();
                break;
              case 7:
                obj.rlnIdentifier = reader.bytes();
                break;
              default:
                reader.skipType(tag & 7);
                break;
            }
          }

          if (obj.proof == null) {
            throw new Error(
              'Protocol error: value for required field "proof" was not found in protobuf'
            );
          }

          if (obj.merkleRoot == null) {
            throw new Error(
              'Protocol error: value for required field "merkleRoot" was not found in protobuf'
            );
          }

          if (obj.epoch == null) {
            throw new Error(
              'Protocol error: value for required field "epoch" was not found in protobuf'
            );
          }

          if (obj.shareX == null) {
            throw new Error(
              'Protocol error: value for required field "shareX" was not found in protobuf'
            );
          }

          if (obj.shareY == null) {
            throw new Error(
              'Protocol error: value for required field "shareY" was not found in protobuf'
            );
          }

          if (obj.nullifier == null) {
            throw new Error(
              'Protocol error: value for required field "nullifier" was not found in protobuf'
            );
          }

          if (obj.rlnIdentifier == null) {
            throw new Error(
              'Protocol error: value for required field "rlnIdentifier" was not found in protobuf'
            );
          }

          return obj;
        }
      );
    }

    return _codec;
  };

  export const encode = (obj: RateLimitProof): Uint8Array => {
    return encodeMessage(obj, RateLimitProof.codec());
  };

  export const decode = (buf: Uint8Array | Uint8ArrayList): RateLimitProof => {
    return decodeMessage(buf, RateLimitProof.codec());
  };
}

export interface WakuMessage {
  payload?: Uint8Array;
  contentTopic?: string;
  version?: number;
  timestampDeprecated?: number;
  timestamp?: bigint;
  rateLimitProof?: RateLimitProof;
}

export namespace WakuMessage {
  let _codec: Codec<WakuMessage>;

  export const codec = (): Codec<WakuMessage> => {
    if (_codec == null) {
      _codec = message<WakuMessage>(
        (obj, writer, opts = {}) => {
          if (opts.lengthDelimited !== false) {
            writer.fork();
          }

          if (obj.payload != null) {
            writer.uint32(10);
            writer.bytes(obj.payload);
          }

          if (obj.contentTopic != null) {
            writer.uint32(18);
            writer.string(obj.contentTopic);
          }

          if (obj.version != null) {
            writer.uint32(24);
            writer.uint32(obj.version);
          }

          if (obj.timestampDeprecated != null) {
            writer.uint32(33);
            writer.double(obj.timestampDeprecated);
          }

          if (obj.timestamp != null) {
            writer.uint32(80);
            writer.sint64(obj.timestamp);
          }

          if (obj.rateLimitProof != null) {
            writer.uint32(170);
            RateLimitProof.codec().encode(obj.rateLimitProof, writer);
          }

          if (opts.lengthDelimited !== false) {
            writer.ldelim();
          }
        },
        (reader, length) => {
          const obj: any = {};

          const end = length == null ? reader.len : reader.pos + length;

          while (reader.pos < end) {
            const tag = reader.uint32();

            switch (tag >>> 3) {
              case 1:
                obj.payload = reader.bytes();
                break;
              case 2:
                obj.contentTopic = reader.string();
                break;
              case 3:
                obj.version = reader.uint32();
                break;
              case 4:
                obj.timestampDeprecated = reader.double();
                break;
              case 10:
                obj.timestamp = reader.sint64();
                break;
              case 21:
                obj.rateLimitProof = RateLimitProof.codec().decode(
                  reader,
                  reader.uint32()
                );
                break;
              default:
                reader.skipType(tag & 7);
                break;
            }
          }

          return obj;
        }
      );
    }

    return _codec;
  };

  export const encode = (obj: WakuMessage): Uint8Array => {
    return encodeMessage(obj, WakuMessage.codec());
  };

  export const decode = (buf: Uint8Array | Uint8ArrayList): WakuMessage => {
    return decodeMessage(buf, WakuMessage.codec());
  };
}

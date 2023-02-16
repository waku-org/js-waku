/* eslint-disable import/export */
/* eslint-disable complexity */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-unnecessary-boolean-literal-compare */
/* eslint-disable @typescript-eslint/no-empty-interface */

import { encodeMessage, decodeMessage, message } from "protons-runtime";
import type { Codec } from "protons-runtime";
import type { Uint8ArrayList } from "uint8arraylist";

export interface PushRequest {
  pubSubTopic?: string;
  message?: WakuMessage;
}

export namespace PushRequest {
  let _codec: Codec<PushRequest>;

  export const codec = (): Codec<PushRequest> => {
    if (_codec == null) {
      _codec = message<PushRequest>(
        (obj, w, opts = {}) => {
          if (opts.lengthDelimited !== false) {
            w.fork();
          }

          if (obj.pubSubTopic != null) {
            w.uint32(10);
            w.string(obj.pubSubTopic);
          }

          if (obj.message != null) {
            w.uint32(18);
            WakuMessage.codec().encode(obj.message, w);
          }

          if (opts.lengthDelimited !== false) {
            w.ldelim();
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

  export const encode = (obj: Partial<PushRequest>): Uint8Array => {
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
        (obj, w, opts = {}) => {
          if (opts.lengthDelimited !== false) {
            w.fork();
          }

          if (obj.isSuccess != null) {
            w.uint32(8);
            w.bool(obj.isSuccess);
          }

          if (obj.info != null) {
            w.uint32(18);
            w.string(obj.info);
          }

          if (opts.lengthDelimited !== false) {
            w.ldelim();
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

  export const encode = (obj: Partial<PushResponse>): Uint8Array => {
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
        (obj, w, opts = {}) => {
          if (opts.lengthDelimited !== false) {
            w.fork();
          }

          if (obj.requestId != null) {
            w.uint32(10);
            w.string(obj.requestId);
          }

          if (obj.request != null) {
            w.uint32(18);
            PushRequest.codec().encode(obj.request, w);
          }

          if (obj.response != null) {
            w.uint32(26);
            PushResponse.codec().encode(obj.response, w);
          }

          if (opts.lengthDelimited !== false) {
            w.ldelim();
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

  export const encode = (obj: Partial<PushRPC>): Uint8Array => {
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
        (obj, w, opts = {}) => {
          if (opts.lengthDelimited !== false) {
            w.fork();
          }

          if (obj.proof != null && obj.proof.byteLength > 0) {
            w.uint32(10);
            w.bytes(obj.proof);
          }

          if (obj.merkleRoot != null && obj.merkleRoot.byteLength > 0) {
            w.uint32(18);
            w.bytes(obj.merkleRoot);
          }

          if (obj.epoch != null && obj.epoch.byteLength > 0) {
            w.uint32(26);
            w.bytes(obj.epoch);
          }

          if (obj.shareX != null && obj.shareX.byteLength > 0) {
            w.uint32(34);
            w.bytes(obj.shareX);
          }

          if (obj.shareY != null && obj.shareY.byteLength > 0) {
            w.uint32(42);
            w.bytes(obj.shareY);
          }

          if (obj.nullifier != null && obj.nullifier.byteLength > 0) {
            w.uint32(50);
            w.bytes(obj.nullifier);
          }

          if (obj.rlnIdentifier != null && obj.rlnIdentifier.byteLength > 0) {
            w.uint32(58);
            w.bytes(obj.rlnIdentifier);
          }

          if (opts.lengthDelimited !== false) {
            w.ldelim();
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

          return obj;
        }
      );
    }

    return _codec;
  };

  export const encode = (obj: Partial<RateLimitProof>): Uint8Array => {
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
  ephemeral?: boolean;
}

export namespace WakuMessage {
  let _codec: Codec<WakuMessage>;

  export const codec = (): Codec<WakuMessage> => {
    if (_codec == null) {
      _codec = message<WakuMessage>(
        (obj, w, opts = {}) => {
          if (opts.lengthDelimited !== false) {
            w.fork();
          }

          if (obj.payload != null) {
            w.uint32(10);
            w.bytes(obj.payload);
          }

          if (obj.contentTopic != null) {
            w.uint32(18);
            w.string(obj.contentTopic);
          }

          if (obj.version != null) {
            w.uint32(24);
            w.uint32(obj.version);
          }

          if (obj.timestampDeprecated != null) {
            w.uint32(33);
            w.double(obj.timestampDeprecated);
          }

          if (obj.timestamp != null) {
            w.uint32(80);
            w.sint64(obj.timestamp);
          }

          if (obj.rateLimitProof != null) {
            w.uint32(170);
            RateLimitProof.codec().encode(obj.rateLimitProof, w);
          }

          if (obj.ephemeral != null) {
            w.uint32(248);
            w.bool(obj.ephemeral);
          }

          if (opts.lengthDelimited !== false) {
            w.ldelim();
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
              case 31:
                obj.ephemeral = reader.bool();
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

  export const encode = (obj: Partial<WakuMessage>): Uint8Array => {
    return encodeMessage(obj, WakuMessage.codec());
  };

  export const decode = (buf: Uint8Array | Uint8ArrayList): WakuMessage => {
    return decodeMessage(buf, WakuMessage.codec());
  };
}

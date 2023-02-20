/* eslint-disable import/export */
/* eslint-disable complexity */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-unnecessary-boolean-literal-compare */
/* eslint-disable @typescript-eslint/no-empty-interface */

import {
  encodeMessage,
  decodeMessage,
  message,
  enumeration,
} from "protons-runtime";
import type { Codec } from "protons-runtime";
import type { Uint8ArrayList } from "uint8arraylist";

export interface Index {
  digest?: Uint8Array;
  receivedTime?: bigint;
  senderTime?: bigint;
  pubsubTopic?: string;
}

export namespace Index {
  let _codec: Codec<Index>;

  export const codec = (): Codec<Index> => {
    if (_codec == null) {
      _codec = message<Index>(
        (obj, w, opts = {}) => {
          if (opts.lengthDelimited !== false) {
            w.fork();
          }

          if (obj.digest != null) {
            w.uint32(10);
            w.bytes(obj.digest);
          }

          if (obj.receivedTime != null) {
            w.uint32(16);
            w.sint64(obj.receivedTime);
          }

          if (obj.senderTime != null) {
            w.uint32(24);
            w.sint64(obj.senderTime);
          }

          if (obj.pubsubTopic != null) {
            w.uint32(34);
            w.string(obj.pubsubTopic);
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
                obj.digest = reader.bytes();
                break;
              case 2:
                obj.receivedTime = reader.sint64();
                break;
              case 3:
                obj.senderTime = reader.sint64();
                break;
              case 4:
                obj.pubsubTopic = reader.string();
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

  export const encode = (obj: Partial<Index>): Uint8Array => {
    return encodeMessage(obj, Index.codec());
  };

  export const decode = (buf: Uint8Array | Uint8ArrayList): Index => {
    return decodeMessage(buf, Index.codec());
  };
}

export interface PagingInfo {
  pageSize?: bigint;
  cursor?: Index;
  direction?: PagingInfo.Direction;
}

export namespace PagingInfo {
  export enum Direction {
    DIRECTION_BACKWARD_UNSPECIFIED = "DIRECTION_BACKWARD_UNSPECIFIED",
    DIRECTION_FORWARD = "DIRECTION_FORWARD",
  }

  enum __DirectionValues {
    DIRECTION_BACKWARD_UNSPECIFIED = 0,
    DIRECTION_FORWARD = 1,
  }

  export namespace Direction {
    export const codec = (): Codec<Direction> => {
      return enumeration<Direction>(__DirectionValues);
    };
  }

  let _codec: Codec<PagingInfo>;

  export const codec = (): Codec<PagingInfo> => {
    if (_codec == null) {
      _codec = message<PagingInfo>(
        (obj, w, opts = {}) => {
          if (opts.lengthDelimited !== false) {
            w.fork();
          }

          if (obj.pageSize != null) {
            w.uint32(8);
            w.uint64(obj.pageSize);
          }

          if (obj.cursor != null) {
            w.uint32(18);
            Index.codec().encode(obj.cursor, w);
          }

          if (obj.direction != null) {
            w.uint32(24);
            PagingInfo.Direction.codec().encode(obj.direction, w);
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
                obj.pageSize = reader.uint64();
                break;
              case 2:
                obj.cursor = Index.codec().decode(reader, reader.uint32());
                break;
              case 3:
                obj.direction = PagingInfo.Direction.codec().decode(reader);
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

  export const encode = (obj: Partial<PagingInfo>): Uint8Array => {
    return encodeMessage(obj, PagingInfo.codec());
  };

  export const decode = (buf: Uint8Array | Uint8ArrayList): PagingInfo => {
    return decodeMessage(buf, PagingInfo.codec());
  };
}

export interface ContentFilter {
  contentTopic?: string;
}

export namespace ContentFilter {
  let _codec: Codec<ContentFilter>;

  export const codec = (): Codec<ContentFilter> => {
    if (_codec == null) {
      _codec = message<ContentFilter>(
        (obj, w, opts = {}) => {
          if (opts.lengthDelimited !== false) {
            w.fork();
          }

          if (obj.contentTopic != null) {
            w.uint32(10);
            w.string(obj.contentTopic);
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
                obj.contentTopic = reader.string();
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

  export const encode = (obj: Partial<ContentFilter>): Uint8Array => {
    return encodeMessage(obj, ContentFilter.codec());
  };

  export const decode = (buf: Uint8Array | Uint8ArrayList): ContentFilter => {
    return decodeMessage(buf, ContentFilter.codec());
  };
}

export interface HistoryQuery {
  pubSubTopic?: string;
  contentFilters: ContentFilter[];
  pagingInfo?: PagingInfo;
  startTime?: bigint;
  endTime?: bigint;
}

export namespace HistoryQuery {
  let _codec: Codec<HistoryQuery>;

  export const codec = (): Codec<HistoryQuery> => {
    if (_codec == null) {
      _codec = message<HistoryQuery>(
        (obj, w, opts = {}) => {
          if (opts.lengthDelimited !== false) {
            w.fork();
          }

          if (obj.pubSubTopic != null) {
            w.uint32(18);
            w.string(obj.pubSubTopic);
          }

          if (obj.contentFilters != null) {
            for (const value of obj.contentFilters) {
              w.uint32(26);
              ContentFilter.codec().encode(value, w);
            }
          }

          if (obj.pagingInfo != null) {
            w.uint32(34);
            PagingInfo.codec().encode(obj.pagingInfo, w);
          }

          if (obj.startTime != null) {
            w.uint32(40);
            w.sint64(obj.startTime);
          }

          if (obj.endTime != null) {
            w.uint32(48);
            w.sint64(obj.endTime);
          }

          if (opts.lengthDelimited !== false) {
            w.ldelim();
          }
        },
        (reader, length) => {
          const obj: any = {
            contentFilters: [],
          };

          const end = length == null ? reader.len : reader.pos + length;

          while (reader.pos < end) {
            const tag = reader.uint32();

            switch (tag >>> 3) {
              case 2:
                obj.pubSubTopic = reader.string();
                break;
              case 3:
                obj.contentFilters.push(
                  ContentFilter.codec().decode(reader, reader.uint32())
                );
                break;
              case 4:
                obj.pagingInfo = PagingInfo.codec().decode(
                  reader,
                  reader.uint32()
                );
                break;
              case 5:
                obj.startTime = reader.sint64();
                break;
              case 6:
                obj.endTime = reader.sint64();
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

  export const encode = (obj: Partial<HistoryQuery>): Uint8Array => {
    return encodeMessage(obj, HistoryQuery.codec());
  };

  export const decode = (buf: Uint8Array | Uint8ArrayList): HistoryQuery => {
    return decodeMessage(buf, HistoryQuery.codec());
  };
}

export interface HistoryResponse {
  messages: WakuMessage[];
  pagingInfo?: PagingInfo;
  error?: HistoryResponse.HistoryError;
}

export namespace HistoryResponse {
  export enum HistoryError {
    ERROR_NONE_UNSPECIFIED = "ERROR_NONE_UNSPECIFIED",
    ERROR_INVALID_CURSOR = "ERROR_INVALID_CURSOR",
  }

  enum __HistoryErrorValues {
    ERROR_NONE_UNSPECIFIED = 0,
    ERROR_INVALID_CURSOR = 1,
  }

  export namespace HistoryError {
    export const codec = (): Codec<HistoryError> => {
      return enumeration<HistoryError>(__HistoryErrorValues);
    };
  }

  let _codec: Codec<HistoryResponse>;

  export const codec = (): Codec<HistoryResponse> => {
    if (_codec == null) {
      _codec = message<HistoryResponse>(
        (obj, w, opts = {}) => {
          if (opts.lengthDelimited !== false) {
            w.fork();
          }

          if (obj.messages != null) {
            for (const value of obj.messages) {
              w.uint32(18);
              WakuMessage.codec().encode(value, w);
            }
          }

          if (obj.pagingInfo != null) {
            w.uint32(26);
            PagingInfo.codec().encode(obj.pagingInfo, w);
          }

          if (obj.error != null) {
            w.uint32(32);
            HistoryResponse.HistoryError.codec().encode(obj.error, w);
          }

          if (opts.lengthDelimited !== false) {
            w.ldelim();
          }
        },
        (reader, length) => {
          const obj: any = {
            messages: [],
          };

          const end = length == null ? reader.len : reader.pos + length;

          while (reader.pos < end) {
            const tag = reader.uint32();

            switch (tag >>> 3) {
              case 2:
                obj.messages.push(
                  WakuMessage.codec().decode(reader, reader.uint32())
                );
                break;
              case 3:
                obj.pagingInfo = PagingInfo.codec().decode(
                  reader,
                  reader.uint32()
                );
                break;
              case 4:
                obj.error = HistoryResponse.HistoryError.codec().decode(reader);
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

  export const encode = (obj: Partial<HistoryResponse>): Uint8Array => {
    return encodeMessage(obj, HistoryResponse.codec());
  };

  export const decode = (buf: Uint8Array | Uint8ArrayList): HistoryResponse => {
    return decodeMessage(buf, HistoryResponse.codec());
  };
}

export interface HistoryRPC {
  requestId?: string;
  query?: HistoryQuery;
  response?: HistoryResponse;
}

export namespace HistoryRPC {
  let _codec: Codec<HistoryRPC>;

  export const codec = (): Codec<HistoryRPC> => {
    if (_codec == null) {
      _codec = message<HistoryRPC>(
        (obj, w, opts = {}) => {
          if (opts.lengthDelimited !== false) {
            w.fork();
          }

          if (obj.requestId != null) {
            w.uint32(10);
            w.string(obj.requestId);
          }

          if (obj.query != null) {
            w.uint32(18);
            HistoryQuery.codec().encode(obj.query, w);
          }

          if (obj.response != null) {
            w.uint32(26);
            HistoryResponse.codec().encode(obj.response, w);
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
                obj.query = HistoryQuery.codec().decode(
                  reader,
                  reader.uint32()
                );
                break;
              case 3:
                obj.response = HistoryResponse.codec().decode(
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

  export const encode = (obj: Partial<HistoryRPC>): Uint8Array => {
    return encodeMessage(obj, HistoryRPC.codec());
  };

  export const decode = (buf: Uint8Array | Uint8ArrayList): HistoryRPC => {
    return decodeMessage(buf, HistoryRPC.codec());
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

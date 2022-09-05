/* eslint-disable import/export */
/* eslint-disable @typescript-eslint/no-namespace */

import {
  encodeMessage,
  decodeMessage,
  message,
  enumeration,
} from "protons-runtime";
import type { Uint8ArrayList } from "uint8arraylist";
import type { Codec } from "protons-runtime";

export interface Index {
  digest?: Uint8Array;
  receivedTime?: number;
  senderTime?: number;
}

export namespace Index {
  let _codec: Codec<Index>;

  export const codec = (): Codec<Index> => {
    if (_codec == null) {
      _codec = message<Index>(
        (obj, writer, opts = {}) => {
          if (opts.lengthDelimited !== false) {
            writer.fork();
          }

          if (obj.digest != null) {
            writer.uint32(10);
            writer.bytes(obj.digest);
          }

          if (obj.receivedTime != null) {
            writer.uint32(17);
            writer.double(obj.receivedTime);
          }

          if (obj.senderTime != null) {
            writer.uint32(25);
            writer.double(obj.senderTime);
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
                obj.digest = reader.bytes();
                break;
              case 2:
                obj.receivedTime = reader.double();
                break;
              case 3:
                obj.senderTime = reader.double();
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

  export const encode = (obj: Index): Uint8Array => {
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
    export const codec = () => {
      return enumeration<Direction>(__DirectionValues);
    };
  }

  let _codec: Codec<PagingInfo>;

  export const codec = (): Codec<PagingInfo> => {
    if (_codec == null) {
      _codec = message<PagingInfo>(
        (obj, writer, opts = {}) => {
          if (opts.lengthDelimited !== false) {
            writer.fork();
          }

          if (obj.pageSize != null) {
            writer.uint32(8);
            writer.uint64(obj.pageSize);
          }

          if (obj.cursor != null) {
            writer.uint32(18);
            Index.codec().encode(obj.cursor, writer);
          }

          if (obj.direction != null) {
            writer.uint32(24);
            PagingInfo.Direction.codec().encode(obj.direction, writer);
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

  export const encode = (obj: PagingInfo): Uint8Array => {
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
        (obj, writer, opts = {}) => {
          if (opts.lengthDelimited !== false) {
            writer.fork();
          }

          if (obj.contentTopic != null) {
            writer.uint32(10);
            writer.string(obj.contentTopic);
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

  export const encode = (obj: ContentFilter): Uint8Array => {
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
  startTime?: number;
  endTime?: number;
}

export namespace HistoryQuery {
  let _codec: Codec<HistoryQuery>;

  export const codec = (): Codec<HistoryQuery> => {
    if (_codec == null) {
      _codec = message<HistoryQuery>(
        (obj, writer, opts = {}) => {
          if (opts.lengthDelimited !== false) {
            writer.fork();
          }

          if (obj.pubSubTopic != null) {
            writer.uint32(18);
            writer.string(obj.pubSubTopic);
          }

          if (obj.contentFilters != null) {
            for (const value of obj.contentFilters) {
              writer.uint32(26);
              ContentFilter.codec().encode(value, writer);
            }
          } else {
            throw new Error(
              'Protocol error: required field "contentFilters" was not found in object'
            );
          }

          if (obj.pagingInfo != null) {
            writer.uint32(34);
            PagingInfo.codec().encode(obj.pagingInfo, writer);
          }

          if (obj.startTime != null) {
            writer.uint32(41);
            writer.double(obj.startTime);
          }

          if (obj.endTime != null) {
            writer.uint32(49);
            writer.double(obj.endTime);
          }

          if (opts.lengthDelimited !== false) {
            writer.ldelim();
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
                obj.startTime = reader.double();
                break;
              case 6:
                obj.endTime = reader.double();
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

  export const encode = (obj: HistoryQuery): Uint8Array => {
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
    export const codec = () => {
      return enumeration<HistoryError>(__HistoryErrorValues);
    };
  }

  let _codec: Codec<HistoryResponse>;

  export const codec = (): Codec<HistoryResponse> => {
    if (_codec == null) {
      _codec = message<HistoryResponse>(
        (obj, writer, opts = {}) => {
          if (opts.lengthDelimited !== false) {
            writer.fork();
          }

          if (obj.messages != null) {
            for (const value of obj.messages) {
              writer.uint32(18);
              WakuMessage.codec().encode(value, writer);
            }
          } else {
            throw new Error(
              'Protocol error: required field "messages" was not found in object'
            );
          }

          if (obj.pagingInfo != null) {
            writer.uint32(26);
            PagingInfo.codec().encode(obj.pagingInfo, writer);
          }

          if (obj.error != null) {
            writer.uint32(32);
            HistoryResponse.HistoryError.codec().encode(obj.error, writer);
          }

          if (opts.lengthDelimited !== false) {
            writer.ldelim();
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

  export const encode = (obj: HistoryResponse): Uint8Array => {
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
        (obj, writer, opts = {}) => {
          if (opts.lengthDelimited !== false) {
            writer.fork();
          }

          if (obj.requestId != null) {
            writer.uint32(10);
            writer.string(obj.requestId);
          }

          if (obj.query != null) {
            writer.uint32(18);
            HistoryQuery.codec().encode(obj.query, writer);
          }

          if (obj.response != null) {
            writer.uint32(26);
            HistoryResponse.codec().encode(obj.response, writer);
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

  export const encode = (obj: HistoryRPC): Uint8Array => {
    return encodeMessage(obj, HistoryRPC.codec());
  };

  export const decode = (buf: Uint8Array | Uint8ArrayList): HistoryRPC => {
    return decodeMessage(buf, HistoryRPC.codec());
  };
}

export interface WakuMessage {
  payload?: Uint8Array;
  contentTopic?: string;
  version?: number;
  timestampDeprecated?: number;
  timestamp?: bigint;
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

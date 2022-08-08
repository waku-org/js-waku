/* eslint-disable import/export */
/* eslint-disable @typescript-eslint/no-namespace */

import {
  encodeMessage,
  decodeMessage,
  message,
  bytes,
  double,
  enumeration,
  uint64,
  string,
  uint32,
  sint64,
} from "protons-runtime";
import type { Codec } from "protons-runtime";
import type { Uint8ArrayList } from "uint8arraylist";

export interface Index {
  digest?: Uint8Array;
  receivedTime?: number;
  senderTime?: number;
}

export namespace Index {
  let _codec: Codec<Index>;

  export const codec = (): Codec<Index> => {
    if (_codec == null) {
      _codec = message<Index>({
        1: { name: "digest", codec: bytes, optional: true },
        2: { name: "receivedTime", codec: double, optional: true },
        3: { name: "senderTime", codec: double, optional: true },
      });
    }

    return _codec;
  };

  export const encode = (obj: Index): Uint8ArrayList => {
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
      return enumeration<typeof Direction>(__DirectionValues);
    };
  }

  let _codec: Codec<PagingInfo>;

  export const codec = (): Codec<PagingInfo> => {
    if (_codec == null) {
      _codec = message<PagingInfo>({
        1: { name: "pageSize", codec: uint64, optional: true },
        2: { name: "cursor", codec: Index.codec(), optional: true },
        3: {
          name: "direction",
          codec: PagingInfo.Direction.codec(),
          optional: true,
        },
      });
    }

    return _codec;
  };

  export const encode = (obj: PagingInfo): Uint8ArrayList => {
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
      _codec = message<ContentFilter>({
        1: { name: "contentTopic", codec: string, optional: true },
      });
    }

    return _codec;
  };

  export const encode = (obj: ContentFilter): Uint8ArrayList => {
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
      _codec = message<HistoryQuery>({
        2: { name: "pubSubTopic", codec: string, optional: true },
        3: {
          name: "contentFilters",
          codec: ContentFilter.codec(),
          repeats: true,
        },
        4: { name: "pagingInfo", codec: PagingInfo.codec(), optional: true },
        5: { name: "startTime", codec: double, optional: true },
        6: { name: "endTime", codec: double, optional: true },
      });
    }

    return _codec;
  };

  export const encode = (obj: HistoryQuery): Uint8ArrayList => {
    return encodeMessage(obj, HistoryQuery.codec());
  };

  export const decode = (buf: Uint8Array | Uint8ArrayList): HistoryQuery => {
    return decodeMessage(buf, HistoryQuery.codec());
  };
}

export interface HistoryResponse {
  messages: WakuMessage[];
  pagingInfo?: PagingInfo;
  error?: HistoryResponse.Error;
}

export namespace HistoryResponse {
  export enum Error {
    ERROR_NONE_UNSPECIFIED = "ERROR_NONE_UNSPECIFIED",
    ERROR_INVALID_CURSOR = "ERROR_INVALID_CURSOR",
  }

  enum __ErrorValues {
    ERROR_NONE_UNSPECIFIED = 0,
    ERROR_INVALID_CURSOR = 1,
  }

  export namespace Error {
    export const codec = () => {
      return enumeration<typeof Error>(__ErrorValues);
    };
  }

  let _codec: Codec<HistoryResponse>;

  export const codec = (): Codec<HistoryResponse> => {
    if (_codec == null) {
      _codec = message<HistoryResponse>({
        2: { name: "messages", codec: WakuMessage.codec(), repeats: true },
        3: { name: "pagingInfo", codec: PagingInfo.codec(), optional: true },
        4: {
          name: "error",
          codec: HistoryResponse.Error.codec(),
          optional: true,
        },
      });
    }

    return _codec;
  };

  export const encode = (obj: HistoryResponse): Uint8ArrayList => {
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
      _codec = message<HistoryRPC>({
        1: { name: "requestId", codec: string, optional: true },
        2: { name: "query", codec: HistoryQuery.codec(), optional: true },
        3: { name: "response", codec: HistoryResponse.codec(), optional: true },
      });
    }

    return _codec;
  };

  export const encode = (obj: HistoryRPC): Uint8ArrayList => {
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
      _codec = message<WakuMessage>({
        1: { name: "payload", codec: bytes, optional: true },
        2: { name: "contentTopic", codec: string, optional: true },
        3: { name: "version", codec: uint32, optional: true },
        4: { name: "timestampDeprecated", codec: double, optional: true },
        10: { name: "timestamp", codec: sint64, optional: true },
      });
    }

    return _codec;
  };

  export const encode = (obj: WakuMessage): Uint8ArrayList => {
    return encodeMessage(obj, WakuMessage.codec());
  };

  export const decode = (buf: Uint8Array | Uint8ArrayList): WakuMessage => {
    return decodeMessage(buf, WakuMessage.codec());
  };
}

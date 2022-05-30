/* eslint-disable import/export */
/* eslint-disable @typescript-eslint/no-namespace */

import {
  encodeMessage,
  decodeMessage,
  message,
  bytes,
  sint64,
  string,
  enumeration,
  uint64,
  uint32,
  double,
} from "protons-runtime";
import type { Codec } from "protons-runtime";

export interface Index {
  digest: Uint8Array;
  receivedTime: bigint;
  senderTime: bigint;
  pubsubTopic: string;
}

export namespace Index {
  export const codec = (): Codec<Index> => {
    return message<Index>({
      1: { name: "digest", codec: bytes },
      2: { name: "receivedTime", codec: sint64 },
      3: { name: "senderTime", codec: sint64 },
      4: { name: "pubsubTopic", codec: string },
    });
  };

  export const encode = (obj: Index): Uint8Array => {
    return encodeMessage(obj, Index.codec());
  };

  export const decode = (buf: Uint8Array): Index => {
    return decodeMessage(buf, Index.codec());
  };
}

export interface PagingInfo {
  pageSize: bigint;
  cursor: Index;
  direction: PagingInfo.Direction;
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

  export const codec = (): Codec<PagingInfo> => {
    return message<PagingInfo>({
      1: { name: "pageSize", codec: uint64 },
      2: { name: "cursor", codec: Index.codec() },
      3: { name: "direction", codec: PagingInfo.Direction.codec() },
    });
  };

  export const encode = (obj: PagingInfo): Uint8Array => {
    return encodeMessage(obj, PagingInfo.codec());
  };

  export const decode = (buf: Uint8Array): PagingInfo => {
    return decodeMessage(buf, PagingInfo.codec());
  };
}

export interface ContentFilter {
  contentTopic: string;
}

export namespace ContentFilter {
  export const codec = (): Codec<ContentFilter> => {
    return message<ContentFilter>({
      1: { name: "contentTopic", codec: string },
    });
  };

  export const encode = (obj: ContentFilter): Uint8Array => {
    return encodeMessage(obj, ContentFilter.codec());
  };

  export const decode = (buf: Uint8Array): ContentFilter => {
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
  export const codec = (): Codec<HistoryQuery> => {
    return message<HistoryQuery>({
      2: { name: "pubSubTopic", codec: string, optional: true },
      3: {
        name: "contentFilters",
        codec: ContentFilter.codec(),
        repeats: true,
      },
      4: { name: "pagingInfo", codec: PagingInfo.codec(), optional: true },
      5: { name: "startTime", codec: sint64, optional: true },
      6: { name: "endTime", codec: sint64, optional: true },
    });
  };

  export const encode = (obj: HistoryQuery): Uint8Array => {
    return encodeMessage(obj, HistoryQuery.codec());
  };

  export const decode = (buf: Uint8Array): HistoryQuery => {
    return decodeMessage(buf, HistoryQuery.codec());
  };
}

export interface HistoryResponse {
  messages: WakuMessage[];
  pagingInfo: PagingInfo;
  error: HistoryResponse.Error;
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

  export const codec = (): Codec<HistoryResponse> => {
    return message<HistoryResponse>({
      2: { name: "messages", codec: WakuMessage.codec(), repeats: true },
      3: { name: "pagingInfo", codec: PagingInfo.codec() },
      4: { name: "error", codec: HistoryResponse.Error.codec() },
    });
  };

  export const encode = (obj: HistoryResponse): Uint8Array => {
    return encodeMessage(obj, HistoryResponse.codec());
  };

  export const decode = (buf: Uint8Array): HistoryResponse => {
    return decodeMessage(buf, HistoryResponse.codec());
  };
}

export interface HistoryRPC {
  requestId: string;
  query?: HistoryQuery;
  response?: HistoryResponse;
}

export namespace HistoryRPC {
  export const codec = (): Codec<HistoryRPC> => {
    return message<HistoryRPC>({
      1: { name: "requestId", codec: string },
      2: { name: "query", codec: HistoryQuery.codec(), optional: true },
      3: { name: "response", codec: HistoryResponse.codec(), optional: true },
    });
  };

  export const encode = (obj: HistoryRPC): Uint8Array => {
    return encodeMessage(obj, HistoryRPC.codec());
  };

  export const decode = (buf: Uint8Array): HistoryRPC => {
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
  export const codec = (): Codec<WakuMessage> => {
    return message<WakuMessage>({
      1: { name: "payload", codec: bytes, optional: true },
      2: { name: "contentTopic", codec: string, optional: true },
      3: { name: "version", codec: uint32, optional: true },
      4: { name: "timestampDeprecated", codec: double, optional: true },
      10: { name: "timestamp", codec: sint64, optional: true },
    });
  };

  export const encode = (obj: WakuMessage): Uint8Array => {
    return encodeMessage(obj, WakuMessage.codec());
  };

  export const decode = (buf: Uint8Array): WakuMessage => {
    return decodeMessage(buf, WakuMessage.codec());
  };
}

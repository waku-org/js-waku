/* eslint-disable */
import Long from 'long';
import _m0 from 'protobufjs/minimal';
import { WakuMessage } from '../../waku/v2/message';

export const protobufPackage = 'waku.v2';

export interface Index {
  digest: Uint8Array;
  receivedTime: number;
}

export interface PagingInfo {
  pageSize: number;
  cursor: Index | undefined;
  direction: PagingInfo_Direction;
}

export enum PagingInfo_Direction {
  DIRECTION_BACKWARD_UNSPECIFIED = 0,
  DIRECTION_FORWARD = 1,
  UNRECOGNIZED = -1,
}

export function pagingInfo_DirectionFromJSON(
  object: any
): PagingInfo_Direction {
  switch (object) {
    case 0:
    case 'DIRECTION_BACKWARD_UNSPECIFIED':
      return PagingInfo_Direction.DIRECTION_BACKWARD_UNSPECIFIED;
    case 1:
    case 'DIRECTION_FORWARD':
      return PagingInfo_Direction.DIRECTION_FORWARD;
    case -1:
    case 'UNRECOGNIZED':
    default:
      return PagingInfo_Direction.UNRECOGNIZED;
  }
}

export function pagingInfo_DirectionToJSON(
  object: PagingInfo_Direction
): string {
  switch (object) {
    case PagingInfo_Direction.DIRECTION_BACKWARD_UNSPECIFIED:
      return 'DIRECTION_BACKWARD_UNSPECIFIED';
    case PagingInfo_Direction.DIRECTION_FORWARD:
      return 'DIRECTION_FORWARD';
    default:
      return 'UNKNOWN';
  }
}

export interface ContentFilter {
  contentTopic: string;
}

export interface HistoryQuery {
  pubsubTopic?: string | undefined;
  contentFilters: ContentFilter[];
  pagingInfo?: PagingInfo | undefined;
  startTime?: number | undefined;
  endTime?: number | undefined;
}

export interface HistoryResponse {
  messages: WakuMessage[];
  pagingInfo: PagingInfo | undefined;
}

export interface HistoryRPC {
  requestId: string;
  query: HistoryQuery | undefined;
  response: HistoryResponse | undefined;
}

const baseIndex: object = { receivedTime: 0 };

export const Index = {
  encode(message: Index, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.digest.length !== 0) {
      writer.uint32(10).bytes(message.digest);
    }
    if (message.receivedTime !== 0) {
      writer.uint32(17).double(message.receivedTime);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): Index {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = { ...baseIndex } as Index;
    message.digest = new Uint8Array();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.digest = reader.bytes();
          break;
        case 2:
          message.receivedTime = reader.double();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): Index {
    const message = { ...baseIndex } as Index;
    message.digest = new Uint8Array();
    if (object.digest !== undefined && object.digest !== null) {
      message.digest = bytesFromBase64(object.digest);
    }
    if (object.receivedTime !== undefined && object.receivedTime !== null) {
      message.receivedTime = Number(object.receivedTime);
    } else {
      message.receivedTime = 0;
    }
    return message;
  },

  toJSON(message: Index): unknown {
    const obj: any = {};
    message.digest !== undefined &&
      (obj.digest = base64FromBytes(
        message.digest !== undefined ? message.digest : new Uint8Array()
      ));
    message.receivedTime !== undefined &&
      (obj.receivedTime = message.receivedTime);
    return obj;
  },

  fromPartial(object: DeepPartial<Index>): Index {
    const message = { ...baseIndex } as Index;
    if (object.digest !== undefined && object.digest !== null) {
      message.digest = object.digest;
    } else {
      message.digest = new Uint8Array();
    }
    if (object.receivedTime !== undefined && object.receivedTime !== null) {
      message.receivedTime = object.receivedTime;
    } else {
      message.receivedTime = 0;
    }
    return message;
  },
};

const basePagingInfo: object = { pageSize: 0, direction: 0 };

export const PagingInfo = {
  encode(
    message: PagingInfo,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.pageSize !== 0) {
      writer.uint32(8).uint64(message.pageSize);
    }
    if (message.cursor !== undefined) {
      Index.encode(message.cursor, writer.uint32(18).fork()).ldelim();
    }
    if (message.direction !== 0) {
      writer.uint32(24).int32(message.direction);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): PagingInfo {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = { ...basePagingInfo } as PagingInfo;
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.pageSize = longToNumber(reader.uint64() as Long);
          break;
        case 2:
          message.cursor = Index.decode(reader, reader.uint32());
          break;
        case 3:
          message.direction = reader.int32() as any;
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): PagingInfo {
    const message = { ...basePagingInfo } as PagingInfo;
    if (object.pageSize !== undefined && object.pageSize !== null) {
      message.pageSize = Number(object.pageSize);
    } else {
      message.pageSize = 0;
    }
    if (object.cursor !== undefined && object.cursor !== null) {
      message.cursor = Index.fromJSON(object.cursor);
    } else {
      message.cursor = undefined;
    }
    if (object.direction !== undefined && object.direction !== null) {
      message.direction = pagingInfo_DirectionFromJSON(object.direction);
    } else {
      message.direction = 0;
    }
    return message;
  },

  toJSON(message: PagingInfo): unknown {
    const obj: any = {};
    message.pageSize !== undefined && (obj.pageSize = message.pageSize);
    message.cursor !== undefined &&
      (obj.cursor = message.cursor ? Index.toJSON(message.cursor) : undefined);
    message.direction !== undefined &&
      (obj.direction = pagingInfo_DirectionToJSON(message.direction));
    return obj;
  },

  fromPartial(object: DeepPartial<PagingInfo>): PagingInfo {
    const message = { ...basePagingInfo } as PagingInfo;
    if (object.pageSize !== undefined && object.pageSize !== null) {
      message.pageSize = object.pageSize;
    } else {
      message.pageSize = 0;
    }
    if (object.cursor !== undefined && object.cursor !== null) {
      message.cursor = Index.fromPartial(object.cursor);
    } else {
      message.cursor = undefined;
    }
    if (object.direction !== undefined && object.direction !== null) {
      message.direction = object.direction;
    } else {
      message.direction = 0;
    }
    return message;
  },
};

const baseContentFilter: object = { contentTopic: '' };

export const ContentFilter = {
  encode(
    message: ContentFilter,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.contentTopic !== '') {
      writer.uint32(10).string(message.contentTopic);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ContentFilter {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = { ...baseContentFilter } as ContentFilter;
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.contentTopic = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): ContentFilter {
    const message = { ...baseContentFilter } as ContentFilter;
    if (object.contentTopic !== undefined && object.contentTopic !== null) {
      message.contentTopic = String(object.contentTopic);
    } else {
      message.contentTopic = '';
    }
    return message;
  },

  toJSON(message: ContentFilter): unknown {
    const obj: any = {};
    message.contentTopic !== undefined &&
      (obj.contentTopic = message.contentTopic);
    return obj;
  },

  fromPartial(object: DeepPartial<ContentFilter>): ContentFilter {
    const message = { ...baseContentFilter } as ContentFilter;
    if (object.contentTopic !== undefined && object.contentTopic !== null) {
      message.contentTopic = object.contentTopic;
    } else {
      message.contentTopic = '';
    }
    return message;
  },
};

const baseHistoryQuery: object = {};

export const HistoryQuery = {
  encode(
    message: HistoryQuery,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.pubsubTopic !== undefined) {
      writer.uint32(18).string(message.pubsubTopic);
    }
    for (const v of message.contentFilters) {
      ContentFilter.encode(v!, writer.uint32(26).fork()).ldelim();
    }
    if (message.pagingInfo !== undefined) {
      PagingInfo.encode(message.pagingInfo, writer.uint32(34).fork()).ldelim();
    }
    if (message.startTime !== undefined) {
      writer.uint32(41).double(message.startTime);
    }
    if (message.endTime !== undefined) {
      writer.uint32(49).double(message.endTime);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): HistoryQuery {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = { ...baseHistoryQuery } as HistoryQuery;
    message.contentFilters = [];
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 2:
          message.pubsubTopic = reader.string();
          break;
        case 3:
          message.contentFilters.push(
            ContentFilter.decode(reader, reader.uint32())
          );
          break;
        case 4:
          message.pagingInfo = PagingInfo.decode(reader, reader.uint32());
          break;
        case 5:
          message.startTime = reader.double();
          break;
        case 6:
          message.endTime = reader.double();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): HistoryQuery {
    const message = { ...baseHistoryQuery } as HistoryQuery;
    message.contentFilters = [];
    if (object.pubsubTopic !== undefined && object.pubsubTopic !== null) {
      message.pubsubTopic = String(object.pubsubTopic);
    } else {
      message.pubsubTopic = undefined;
    }
    if (object.contentFilters !== undefined && object.contentFilters !== null) {
      for (const e of object.contentFilters) {
        message.contentFilters.push(ContentFilter.fromJSON(e));
      }
    }
    if (object.pagingInfo !== undefined && object.pagingInfo !== null) {
      message.pagingInfo = PagingInfo.fromJSON(object.pagingInfo);
    } else {
      message.pagingInfo = undefined;
    }
    if (object.startTime !== undefined && object.startTime !== null) {
      message.startTime = Number(object.startTime);
    } else {
      message.startTime = undefined;
    }
    if (object.endTime !== undefined && object.endTime !== null) {
      message.endTime = Number(object.endTime);
    } else {
      message.endTime = undefined;
    }
    return message;
  },

  toJSON(message: HistoryQuery): unknown {
    const obj: any = {};
    message.pubsubTopic !== undefined &&
      (obj.pubsubTopic = message.pubsubTopic);
    if (message.contentFilters) {
      obj.contentFilters = message.contentFilters.map((e) =>
        e ? ContentFilter.toJSON(e) : undefined
      );
    } else {
      obj.contentFilters = [];
    }
    message.pagingInfo !== undefined &&
      (obj.pagingInfo = message.pagingInfo
        ? PagingInfo.toJSON(message.pagingInfo)
        : undefined);
    message.startTime !== undefined && (obj.startTime = message.startTime);
    message.endTime !== undefined && (obj.endTime = message.endTime);
    return obj;
  },

  fromPartial(object: DeepPartial<HistoryQuery>): HistoryQuery {
    const message = { ...baseHistoryQuery } as HistoryQuery;
    message.contentFilters = [];
    if (object.pubsubTopic !== undefined && object.pubsubTopic !== null) {
      message.pubsubTopic = object.pubsubTopic;
    } else {
      message.pubsubTopic = undefined;
    }
    if (object.contentFilters !== undefined && object.contentFilters !== null) {
      for (const e of object.contentFilters) {
        message.contentFilters.push(ContentFilter.fromPartial(e));
      }
    }
    if (object.pagingInfo !== undefined && object.pagingInfo !== null) {
      message.pagingInfo = PagingInfo.fromPartial(object.pagingInfo);
    } else {
      message.pagingInfo = undefined;
    }
    if (object.startTime !== undefined && object.startTime !== null) {
      message.startTime = object.startTime;
    } else {
      message.startTime = undefined;
    }
    if (object.endTime !== undefined && object.endTime !== null) {
      message.endTime = object.endTime;
    } else {
      message.endTime = undefined;
    }
    return message;
  },
};

const baseHistoryResponse: object = {};

export const HistoryResponse = {
  encode(
    message: HistoryResponse,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    for (const v of message.messages) {
      WakuMessage.encode(v!, writer.uint32(10).fork()).ldelim();
    }
    if (message.pagingInfo !== undefined) {
      PagingInfo.encode(message.pagingInfo, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): HistoryResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = { ...baseHistoryResponse } as HistoryResponse;
    message.messages = [];
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.messages.push(WakuMessage.decode(reader, reader.uint32()));
          break;
        case 2:
          message.pagingInfo = PagingInfo.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): HistoryResponse {
    const message = { ...baseHistoryResponse } as HistoryResponse;
    message.messages = [];
    if (object.messages !== undefined && object.messages !== null) {
      for (const e of object.messages) {
        message.messages.push(WakuMessage.fromJSON(e));
      }
    }
    if (object.pagingInfo !== undefined && object.pagingInfo !== null) {
      message.pagingInfo = PagingInfo.fromJSON(object.pagingInfo);
    } else {
      message.pagingInfo = undefined;
    }
    return message;
  },

  toJSON(message: HistoryResponse): unknown {
    const obj: any = {};
    if (message.messages) {
      obj.messages = message.messages.map((e) =>
        e ? WakuMessage.toJSON(e) : undefined
      );
    } else {
      obj.messages = [];
    }
    message.pagingInfo !== undefined &&
      (obj.pagingInfo = message.pagingInfo
        ? PagingInfo.toJSON(message.pagingInfo)
        : undefined);
    return obj;
  },

  fromPartial(object: DeepPartial<HistoryResponse>): HistoryResponse {
    const message = { ...baseHistoryResponse } as HistoryResponse;
    message.messages = [];
    if (object.messages !== undefined && object.messages !== null) {
      for (const e of object.messages) {
        message.messages.push(WakuMessage.fromPartial(e));
      }
    }
    if (object.pagingInfo !== undefined && object.pagingInfo !== null) {
      message.pagingInfo = PagingInfo.fromPartial(object.pagingInfo);
    } else {
      message.pagingInfo = undefined;
    }
    return message;
  },
};

const baseHistoryRPC: object = { requestId: '' };

export const HistoryRPC = {
  encode(
    message: HistoryRPC,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.requestId !== '') {
      writer.uint32(10).string(message.requestId);
    }
    if (message.query !== undefined) {
      HistoryQuery.encode(message.query, writer.uint32(18).fork()).ldelim();
    }
    if (message.response !== undefined) {
      HistoryResponse.encode(
        message.response,
        writer.uint32(26).fork()
      ).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): HistoryRPC {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = { ...baseHistoryRPC } as HistoryRPC;
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.requestId = reader.string();
          break;
        case 2:
          message.query = HistoryQuery.decode(reader, reader.uint32());
          break;
        case 3:
          message.response = HistoryResponse.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): HistoryRPC {
    const message = { ...baseHistoryRPC } as HistoryRPC;
    if (object.requestId !== undefined && object.requestId !== null) {
      message.requestId = String(object.requestId);
    } else {
      message.requestId = '';
    }
    if (object.query !== undefined && object.query !== null) {
      message.query = HistoryQuery.fromJSON(object.query);
    } else {
      message.query = undefined;
    }
    if (object.response !== undefined && object.response !== null) {
      message.response = HistoryResponse.fromJSON(object.response);
    } else {
      message.response = undefined;
    }
    return message;
  },

  toJSON(message: HistoryRPC): unknown {
    const obj: any = {};
    message.requestId !== undefined && (obj.requestId = message.requestId);
    message.query !== undefined &&
      (obj.query = message.query
        ? HistoryQuery.toJSON(message.query)
        : undefined);
    message.response !== undefined &&
      (obj.response = message.response
        ? HistoryResponse.toJSON(message.response)
        : undefined);
    return obj;
  },

  fromPartial(object: DeepPartial<HistoryRPC>): HistoryRPC {
    const message = { ...baseHistoryRPC } as HistoryRPC;
    if (object.requestId !== undefined && object.requestId !== null) {
      message.requestId = object.requestId;
    } else {
      message.requestId = '';
    }
    if (object.query !== undefined && object.query !== null) {
      message.query = HistoryQuery.fromPartial(object.query);
    } else {
      message.query = undefined;
    }
    if (object.response !== undefined && object.response !== null) {
      message.response = HistoryResponse.fromPartial(object.response);
    } else {
      message.response = undefined;
    }
    return message;
  },
};

declare var self: any | undefined;
declare var window: any | undefined;
var globalThis: any = (() => {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof self !== 'undefined') return self;
  if (typeof window !== 'undefined') return window;
  if (typeof global !== 'undefined') return global;
  throw 'Unable to locate global object';
})();

const atob: (b64: string) => string =
  globalThis.atob ||
  ((b64) => globalThis.Buffer.from(b64, 'base64').toString('binary'));
function bytesFromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; ++i) {
    arr[i] = bin.charCodeAt(i);
  }
  return arr;
}

const btoa: (bin: string) => string =
  globalThis.btoa ||
  ((bin) => globalThis.Buffer.from(bin, 'binary').toString('base64'));
function base64FromBytes(arr: Uint8Array): string {
  const bin: string[] = [];
  for (const byte of arr) {
    bin.push(String.fromCharCode(byte));
  }
  return btoa(bin.join(''));
}

type Builtin =
  | Date
  | Function
  | Uint8Array
  | string
  | number
  | boolean
  | undefined;
export type DeepPartial<T> = T extends Builtin
  ? T
  : T extends Array<infer U>
  ? Array<DeepPartial<U>>
  : T extends ReadonlyArray<infer U>
  ? ReadonlyArray<DeepPartial<U>>
  : T extends {}
  ? { [K in keyof T]?: DeepPartial<T[K]> }
  : Partial<T>;

function longToNumber(long: Long): number {
  if (long.gt(Number.MAX_SAFE_INTEGER)) {
    throw new globalThis.Error('Value is larger than Number.MAX_SAFE_INTEGER');
  }
  return long.toNumber();
}

if (_m0.util.Long !== Long) {
  _m0.util.Long = Long as any;
  _m0.configure();
}

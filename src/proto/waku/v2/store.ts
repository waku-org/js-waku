/* eslint-disable */
import Long from 'long';
import _m0 from 'protobufjs/minimal';
import { WakuMessage } from '../../waku/v2/message';

export const protobufPackage = 'waku.v2';

export interface Index {
  digest: Uint8Array;
  receivedTime: number;
  senderTime: number;
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
  pubSubTopic?: string | undefined;
  contentFilters: ContentFilter[];
  pagingInfo?: PagingInfo | undefined;
  startTime?: number | undefined;
  endTime?: number | undefined;
}

export interface HistoryResponse {
  messages: WakuMessage[];
  pagingInfo: PagingInfo | undefined;
  error: HistoryResponse_Error;
}

export enum HistoryResponse_Error {
  ERROR_NONE_UNSPECIFIED = 0,
  ERROR_INVALID_CURSOR = 1,
  UNRECOGNIZED = -1,
}

export function historyResponse_ErrorFromJSON(
  object: any
): HistoryResponse_Error {
  switch (object) {
    case 0:
    case 'ERROR_NONE_UNSPECIFIED':
      return HistoryResponse_Error.ERROR_NONE_UNSPECIFIED;
    case 1:
    case 'ERROR_INVALID_CURSOR':
      return HistoryResponse_Error.ERROR_INVALID_CURSOR;
    case -1:
    case 'UNRECOGNIZED':
    default:
      return HistoryResponse_Error.UNRECOGNIZED;
  }
}

export function historyResponse_ErrorToJSON(
  object: HistoryResponse_Error
): string {
  switch (object) {
    case HistoryResponse_Error.ERROR_NONE_UNSPECIFIED:
      return 'ERROR_NONE_UNSPECIFIED';
    case HistoryResponse_Error.ERROR_INVALID_CURSOR:
      return 'ERROR_INVALID_CURSOR';
    default:
      return 'UNKNOWN';
  }
}

export interface HistoryRPC {
  requestId: string;
  query: HistoryQuery | undefined;
  response: HistoryResponse | undefined;
}

function createBaseIndex(): Index {
  return { digest: new Uint8Array(), receivedTime: 0, senderTime: 0 };
}

export const Index = {
  encode(message: Index, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.digest.length !== 0) {
      writer.uint32(10).bytes(message.digest);
    }
    if (message.receivedTime !== 0) {
      writer.uint32(17).double(message.receivedTime);
    }
    if (message.senderTime !== 0) {
      writer.uint32(25).double(message.senderTime);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): Index {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseIndex();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.digest = reader.bytes();
          break;
        case 2:
          message.receivedTime = reader.double();
          break;
        case 3:
          message.senderTime = reader.double();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): Index {
    const message = createBaseIndex();
    message.digest =
      object.digest !== undefined && object.digest !== null
        ? bytesFromBase64(object.digest)
        : new Uint8Array();
    message.receivedTime =
      object.receivedTime !== undefined && object.receivedTime !== null
        ? Number(object.receivedTime)
        : 0;
    message.senderTime =
      object.senderTime !== undefined && object.senderTime !== null
        ? Number(object.senderTime)
        : 0;
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
    message.senderTime !== undefined && (obj.senderTime = message.senderTime);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<Index>, I>>(object: I): Index {
    const message = createBaseIndex();
    message.digest = object.digest ?? new Uint8Array();
    message.receivedTime = object.receivedTime ?? 0;
    message.senderTime = object.senderTime ?? 0;
    return message;
  },
};

function createBasePagingInfo(): PagingInfo {
  return { pageSize: 0, cursor: undefined, direction: 0 };
}

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
    const message = createBasePagingInfo();
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
    const message = createBasePagingInfo();
    message.pageSize =
      object.pageSize !== undefined && object.pageSize !== null
        ? Number(object.pageSize)
        : 0;
    message.cursor =
      object.cursor !== undefined && object.cursor !== null
        ? Index.fromJSON(object.cursor)
        : undefined;
    message.direction =
      object.direction !== undefined && object.direction !== null
        ? pagingInfo_DirectionFromJSON(object.direction)
        : 0;
    return message;
  },

  toJSON(message: PagingInfo): unknown {
    const obj: any = {};
    message.pageSize !== undefined &&
      (obj.pageSize = Math.round(message.pageSize));
    message.cursor !== undefined &&
      (obj.cursor = message.cursor ? Index.toJSON(message.cursor) : undefined);
    message.direction !== undefined &&
      (obj.direction = pagingInfo_DirectionToJSON(message.direction));
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<PagingInfo>, I>>(
    object: I
  ): PagingInfo {
    const message = createBasePagingInfo();
    message.pageSize = object.pageSize ?? 0;
    message.cursor =
      object.cursor !== undefined && object.cursor !== null
        ? Index.fromPartial(object.cursor)
        : undefined;
    message.direction = object.direction ?? 0;
    return message;
  },
};

function createBaseContentFilter(): ContentFilter {
  return { contentTopic: '' };
}

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
    const message = createBaseContentFilter();
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
    const message = createBaseContentFilter();
    message.contentTopic =
      object.contentTopic !== undefined && object.contentTopic !== null
        ? String(object.contentTopic)
        : '';
    return message;
  },

  toJSON(message: ContentFilter): unknown {
    const obj: any = {};
    message.contentTopic !== undefined &&
      (obj.contentTopic = message.contentTopic);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<ContentFilter>, I>>(
    object: I
  ): ContentFilter {
    const message = createBaseContentFilter();
    message.contentTopic = object.contentTopic ?? '';
    return message;
  },
};

function createBaseHistoryQuery(): HistoryQuery {
  return {
    pubSubTopic: undefined,
    contentFilters: [],
    pagingInfo: undefined,
    startTime: undefined,
    endTime: undefined,
  };
}

export const HistoryQuery = {
  encode(
    message: HistoryQuery,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.pubSubTopic !== undefined) {
      writer.uint32(18).string(message.pubSubTopic);
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
    const message = createBaseHistoryQuery();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 2:
          message.pubSubTopic = reader.string();
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
    const message = createBaseHistoryQuery();
    message.pubSubTopic =
      object.pubSubTopic !== undefined && object.pubSubTopic !== null
        ? String(object.pubSubTopic)
        : undefined;
    message.contentFilters = (object.contentFilters ?? []).map((e: any) =>
      ContentFilter.fromJSON(e)
    );
    message.pagingInfo =
      object.pagingInfo !== undefined && object.pagingInfo !== null
        ? PagingInfo.fromJSON(object.pagingInfo)
        : undefined;
    message.startTime =
      object.startTime !== undefined && object.startTime !== null
        ? Number(object.startTime)
        : undefined;
    message.endTime =
      object.endTime !== undefined && object.endTime !== null
        ? Number(object.endTime)
        : undefined;
    return message;
  },

  toJSON(message: HistoryQuery): unknown {
    const obj: any = {};
    message.pubSubTopic !== undefined &&
      (obj.pubSubTopic = message.pubSubTopic);
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

  fromPartial<I extends Exact<DeepPartial<HistoryQuery>, I>>(
    object: I
  ): HistoryQuery {
    const message = createBaseHistoryQuery();
    message.pubSubTopic = object.pubSubTopic ?? undefined;
    message.contentFilters =
      object.contentFilters?.map((e) => ContentFilter.fromPartial(e)) || [];
    message.pagingInfo =
      object.pagingInfo !== undefined && object.pagingInfo !== null
        ? PagingInfo.fromPartial(object.pagingInfo)
        : undefined;
    message.startTime = object.startTime ?? undefined;
    message.endTime = object.endTime ?? undefined;
    return message;
  },
};

function createBaseHistoryResponse(): HistoryResponse {
  return { messages: [], pagingInfo: undefined, error: 0 };
}

export const HistoryResponse = {
  encode(
    message: HistoryResponse,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    for (const v of message.messages) {
      WakuMessage.encode(v!, writer.uint32(18).fork()).ldelim();
    }
    if (message.pagingInfo !== undefined) {
      PagingInfo.encode(message.pagingInfo, writer.uint32(26).fork()).ldelim();
    }
    if (message.error !== 0) {
      writer.uint32(32).int32(message.error);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): HistoryResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseHistoryResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 2:
          message.messages.push(WakuMessage.decode(reader, reader.uint32()));
          break;
        case 3:
          message.pagingInfo = PagingInfo.decode(reader, reader.uint32());
          break;
        case 4:
          message.error = reader.int32() as any;
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): HistoryResponse {
    const message = createBaseHistoryResponse();
    message.messages = (object.messages ?? []).map((e: any) =>
      WakuMessage.fromJSON(e)
    );
    message.pagingInfo =
      object.pagingInfo !== undefined && object.pagingInfo !== null
        ? PagingInfo.fromJSON(object.pagingInfo)
        : undefined;
    message.error =
      object.error !== undefined && object.error !== null
        ? historyResponse_ErrorFromJSON(object.error)
        : 0;
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
    message.error !== undefined &&
      (obj.error = historyResponse_ErrorToJSON(message.error));
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<HistoryResponse>, I>>(
    object: I
  ): HistoryResponse {
    const message = createBaseHistoryResponse();
    message.messages =
      object.messages?.map((e) => WakuMessage.fromPartial(e)) || [];
    message.pagingInfo =
      object.pagingInfo !== undefined && object.pagingInfo !== null
        ? PagingInfo.fromPartial(object.pagingInfo)
        : undefined;
    message.error = object.error ?? 0;
    return message;
  },
};

function createBaseHistoryRPC(): HistoryRPC {
  return { requestId: '', query: undefined, response: undefined };
}

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
    const message = createBaseHistoryRPC();
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
    const message = createBaseHistoryRPC();
    message.requestId =
      object.requestId !== undefined && object.requestId !== null
        ? String(object.requestId)
        : '';
    message.query =
      object.query !== undefined && object.query !== null
        ? HistoryQuery.fromJSON(object.query)
        : undefined;
    message.response =
      object.response !== undefined && object.response !== null
        ? HistoryResponse.fromJSON(object.response)
        : undefined;
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

  fromPartial<I extends Exact<DeepPartial<HistoryRPC>, I>>(
    object: I
  ): HistoryRPC {
    const message = createBaseHistoryRPC();
    message.requestId = object.requestId ?? '';
    message.query =
      object.query !== undefined && object.query !== null
        ? HistoryQuery.fromPartial(object.query)
        : undefined;
    message.response =
      object.response !== undefined && object.response !== null
        ? HistoryResponse.fromPartial(object.response)
        : undefined;
    return message;
  },
};

declare var self: any | undefined;
declare var window: any | undefined;
declare var global: any | undefined;
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

type KeysOfUnion<T> = T extends T ? keyof T : never;
export type Exact<P, I extends P> = P extends Builtin
  ? P
  : P & { [K in keyof P]: Exact<P[K], I[K]> } & Record<
        Exclude<keyof I, KeysOfUnion<P>>,
        never
      >;

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

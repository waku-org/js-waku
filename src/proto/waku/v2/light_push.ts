/* eslint-disable */
import Long from 'long';
import _m0 from 'protobufjs/minimal';
import { WakuMessage } from '../../waku/v2/message';

export const protobufPackage = 'waku.v2';

export interface PushRequest {
  pubSubTopic: string;
  message: WakuMessage | undefined;
}

export interface PushResponse {
  isSuccess: boolean;
  info: string;
}

export interface PushRPC {
  requestId: string;
  request: PushRequest | undefined;
  response: PushResponse | undefined;
}

function createBasePushRequest(): PushRequest {
  return { pubSubTopic: '', message: undefined };
}

export const PushRequest = {
  encode(
    message: PushRequest,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.pubSubTopic !== '') {
      writer.uint32(10).string(message.pubSubTopic);
    }
    if (message.message !== undefined) {
      WakuMessage.encode(message.message, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): PushRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBasePushRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.pubSubTopic = reader.string();
          break;
        case 2:
          message.message = WakuMessage.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): PushRequest {
    return {
      pubSubTopic: isSet(object.pubSubTopic) ? String(object.pubSubTopic) : '',
      message: isSet(object.message)
        ? WakuMessage.fromJSON(object.message)
        : undefined,
    };
  },

  toJSON(message: PushRequest): unknown {
    const obj: any = {};
    message.pubSubTopic !== undefined &&
      (obj.pubSubTopic = message.pubSubTopic);
    message.message !== undefined &&
      (obj.message = message.message
        ? WakuMessage.toJSON(message.message)
        : undefined);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<PushRequest>, I>>(
    object: I
  ): PushRequest {
    const message = createBasePushRequest();
    message.pubSubTopic = object.pubSubTopic ?? '';
    message.message =
      object.message !== undefined && object.message !== null
        ? WakuMessage.fromPartial(object.message)
        : undefined;
    return message;
  },
};

function createBasePushResponse(): PushResponse {
  return { isSuccess: false, info: '' };
}

export const PushResponse = {
  encode(
    message: PushResponse,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.isSuccess === true) {
      writer.uint32(8).bool(message.isSuccess);
    }
    if (message.info !== '') {
      writer.uint32(18).string(message.info);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): PushResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBasePushResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.isSuccess = reader.bool();
          break;
        case 2:
          message.info = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): PushResponse {
    return {
      isSuccess: isSet(object.isSuccess) ? Boolean(object.isSuccess) : false,
      info: isSet(object.info) ? String(object.info) : '',
    };
  },

  toJSON(message: PushResponse): unknown {
    const obj: any = {};
    message.isSuccess !== undefined && (obj.isSuccess = message.isSuccess);
    message.info !== undefined && (obj.info = message.info);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<PushResponse>, I>>(
    object: I
  ): PushResponse {
    const message = createBasePushResponse();
    message.isSuccess = object.isSuccess ?? false;
    message.info = object.info ?? '';
    return message;
  },
};

function createBasePushRPC(): PushRPC {
  return { requestId: '', request: undefined, response: undefined };
}

export const PushRPC = {
  encode(
    message: PushRPC,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.requestId !== '') {
      writer.uint32(10).string(message.requestId);
    }
    if (message.request !== undefined) {
      PushRequest.encode(message.request, writer.uint32(18).fork()).ldelim();
    }
    if (message.response !== undefined) {
      PushResponse.encode(message.response, writer.uint32(26).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): PushRPC {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBasePushRPC();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.requestId = reader.string();
          break;
        case 2:
          message.request = PushRequest.decode(reader, reader.uint32());
          break;
        case 3:
          message.response = PushResponse.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): PushRPC {
    return {
      requestId: isSet(object.requestId) ? String(object.requestId) : '',
      request: isSet(object.request)
        ? PushRequest.fromJSON(object.request)
        : undefined,
      response: isSet(object.response)
        ? PushResponse.fromJSON(object.response)
        : undefined,
    };
  },

  toJSON(message: PushRPC): unknown {
    const obj: any = {};
    message.requestId !== undefined && (obj.requestId = message.requestId);
    message.request !== undefined &&
      (obj.request = message.request
        ? PushRequest.toJSON(message.request)
        : undefined);
    message.response !== undefined &&
      (obj.response = message.response
        ? PushResponse.toJSON(message.response)
        : undefined);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<PushRPC>, I>>(object: I): PushRPC {
    const message = createBasePushRPC();
    message.requestId = object.requestId ?? '';
    message.request =
      object.request !== undefined && object.request !== null
        ? PushRequest.fromPartial(object.request)
        : undefined;
    message.response =
      object.response !== undefined && object.response !== null
        ? PushResponse.fromPartial(object.response)
        : undefined;
    return message;
  },
};

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

if (_m0.util.Long !== Long) {
  _m0.util.Long = Long as any;
  _m0.configure();
}

function isSet(value: any): boolean {
  return value !== null && value !== undefined;
}

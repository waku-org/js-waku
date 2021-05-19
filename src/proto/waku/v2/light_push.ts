/* eslint-disable */
import Long from 'long';
import _m0 from 'protobufjs/minimal';
import { WakuMessage } from '../../waku/v2/message';

export const protobufPackage = 'waku.v2';

export interface PushRequest {
  pubsubTopic: string;
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

const basePushRequest: object = { pubsubTopic: '' };

export const PushRequest = {
  encode(
    message: PushRequest,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.pubsubTopic !== '') {
      writer.uint32(10).string(message.pubsubTopic);
    }
    if (message.message !== undefined) {
      WakuMessage.encode(message.message, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): PushRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = { ...basePushRequest } as PushRequest;
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.pubsubTopic = reader.string();
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
    const message = { ...basePushRequest } as PushRequest;
    if (object.pubsubTopic !== undefined && object.pubsubTopic !== null) {
      message.pubsubTopic = String(object.pubsubTopic);
    } else {
      message.pubsubTopic = '';
    }
    if (object.message !== undefined && object.message !== null) {
      message.message = WakuMessage.fromJSON(object.message);
    } else {
      message.message = undefined;
    }
    return message;
  },

  toJSON(message: PushRequest): unknown {
    const obj: any = {};
    message.pubsubTopic !== undefined &&
      (obj.pubsubTopic = message.pubsubTopic);
    message.message !== undefined &&
      (obj.message = message.message
        ? WakuMessage.toJSON(message.message)
        : undefined);
    return obj;
  },

  fromPartial(object: DeepPartial<PushRequest>): PushRequest {
    const message = { ...basePushRequest } as PushRequest;
    if (object.pubsubTopic !== undefined && object.pubsubTopic !== null) {
      message.pubsubTopic = object.pubsubTopic;
    } else {
      message.pubsubTopic = '';
    }
    if (object.message !== undefined && object.message !== null) {
      message.message = WakuMessage.fromPartial(object.message);
    } else {
      message.message = undefined;
    }
    return message;
  },
};

const basePushResponse: object = { isSuccess: false, info: '' };

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
    const message = { ...basePushResponse } as PushResponse;
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
    const message = { ...basePushResponse } as PushResponse;
    if (object.isSuccess !== undefined && object.isSuccess !== null) {
      message.isSuccess = Boolean(object.isSuccess);
    } else {
      message.isSuccess = false;
    }
    if (object.info !== undefined && object.info !== null) {
      message.info = String(object.info);
    } else {
      message.info = '';
    }
    return message;
  },

  toJSON(message: PushResponse): unknown {
    const obj: any = {};
    message.isSuccess !== undefined && (obj.isSuccess = message.isSuccess);
    message.info !== undefined && (obj.info = message.info);
    return obj;
  },

  fromPartial(object: DeepPartial<PushResponse>): PushResponse {
    const message = { ...basePushResponse } as PushResponse;
    if (object.isSuccess !== undefined && object.isSuccess !== null) {
      message.isSuccess = object.isSuccess;
    } else {
      message.isSuccess = false;
    }
    if (object.info !== undefined && object.info !== null) {
      message.info = object.info;
    } else {
      message.info = '';
    }
    return message;
  },
};

const basePushRPC: object = { requestId: '' };

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
    const message = { ...basePushRPC } as PushRPC;
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
    const message = { ...basePushRPC } as PushRPC;
    if (object.requestId !== undefined && object.requestId !== null) {
      message.requestId = String(object.requestId);
    } else {
      message.requestId = '';
    }
    if (object.request !== undefined && object.request !== null) {
      message.request = PushRequest.fromJSON(object.request);
    } else {
      message.request = undefined;
    }
    if (object.response !== undefined && object.response !== null) {
      message.response = PushResponse.fromJSON(object.response);
    } else {
      message.response = undefined;
    }
    return message;
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

  fromPartial(object: DeepPartial<PushRPC>): PushRPC {
    const message = { ...basePushRPC } as PushRPC;
    if (object.requestId !== undefined && object.requestId !== null) {
      message.requestId = object.requestId;
    } else {
      message.requestId = '';
    }
    if (object.request !== undefined && object.request !== null) {
      message.request = PushRequest.fromPartial(object.request);
    } else {
      message.request = undefined;
    }
    if (object.response !== undefined && object.response !== null) {
      message.response = PushResponse.fromPartial(object.response);
    } else {
      message.response = undefined;
    }
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

if (_m0.util.Long !== Long) {
  _m0.util.Long = Long as any;
  _m0.configure();
}

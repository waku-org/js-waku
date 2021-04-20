/* eslint-disable */
import Long from 'long';
import _m0 from 'protobufjs/minimal';

export const protobufPackage = 'waku.v2';

export interface WakuMessageProto {
  payload?: Uint8Array | undefined;
  contentTopic?: string | undefined;
  version?: number | undefined;
  timestamp?: number | undefined;
}

const baseWakuMessageProto: object = {};

export const WakuMessageProto = {
  encode(
    message: WakuMessageProto,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.payload !== undefined) {
      writer.uint32(10).bytes(message.payload);
    }
    if (message.contentTopic !== undefined) {
      writer.uint32(18).string(message.contentTopic);
    }
    if (message.version !== undefined) {
      writer.uint32(24).uint32(message.version);
    }
    if (message.timestamp !== undefined) {
      writer.uint32(33).double(message.timestamp);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): WakuMessageProto {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = { ...baseWakuMessageProto } as WakuMessageProto;
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.payload = reader.bytes();
          break;
        case 2:
          message.contentTopic = reader.string();
          break;
        case 3:
          message.version = reader.uint32();
          break;
        case 4:
          message.timestamp = reader.double();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): WakuMessageProto {
    const message = { ...baseWakuMessageProto } as WakuMessageProto;
    if (object.payload !== undefined && object.payload !== null) {
      message.payload = bytesFromBase64(object.payload);
    }
    if (object.contentTopic !== undefined && object.contentTopic !== null) {
      message.contentTopic = String(object.contentTopic);
    } else {
      message.contentTopic = undefined;
    }
    if (object.version !== undefined && object.version !== null) {
      message.version = Number(object.version);
    } else {
      message.version = undefined;
    }
    if (object.timestamp !== undefined && object.timestamp !== null) {
      message.timestamp = Number(object.timestamp);
    } else {
      message.timestamp = undefined;
    }
    return message;
  },

  toJSON(message: WakuMessageProto): unknown {
    const obj: any = {};
    message.payload !== undefined &&
      (obj.payload =
        message.payload !== undefined
          ? base64FromBytes(message.payload)
          : undefined);
    message.contentTopic !== undefined &&
      (obj.contentTopic = message.contentTopic);
    message.version !== undefined && (obj.version = message.version);
    message.timestamp !== undefined && (obj.timestamp = message.timestamp);
    return obj;
  },

  fromPartial(object: DeepPartial<WakuMessageProto>): WakuMessageProto {
    const message = { ...baseWakuMessageProto } as WakuMessageProto;
    if (object.payload !== undefined && object.payload !== null) {
      message.payload = object.payload;
    } else {
      message.payload = undefined;
    }
    if (object.contentTopic !== undefined && object.contentTopic !== null) {
      message.contentTopic = object.contentTopic;
    } else {
      message.contentTopic = undefined;
    }
    if (object.version !== undefined && object.version !== null) {
      message.version = object.version;
    } else {
      message.version = undefined;
    }
    if (object.timestamp !== undefined && object.timestamp !== null) {
      message.timestamp = object.timestamp;
    } else {
      message.timestamp = undefined;
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
  for (let i = 0; i < arr.byteLength; ++i) {
    bin.push(String.fromCharCode(arr[i]));
  }
  return btoa(bin.join(''));
}

type Builtin = Date | Function | Uint8Array | string | number | undefined;
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

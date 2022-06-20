/* eslint-disable import/export */
/* eslint-disable @typescript-eslint/no-namespace */

import {
  encodeMessage,
  decodeMessage,
  message,
  string,
  bool,
  bytes,
  uint32,
  double,
  sint64,
} from "protons-runtime";
import type { Codec } from "protons-runtime";

export interface PushRequest {
  pubSubTopic?: string;
  message?: WakuMessage;
}

export namespace PushRequest {
  export const codec = (): Codec<PushRequest> => {
    return message<PushRequest>({
      1: { name: "pubSubTopic", codec: string, optional: true },
      2: { name: "message", codec: WakuMessage.codec(), optional: true },
    });
  };

  export const encode = (obj: PushRequest): Uint8Array => {
    return encodeMessage(obj, PushRequest.codec());
  };

  export const decode = (buf: Uint8Array): PushRequest => {
    return decodeMessage(buf, PushRequest.codec());
  };
}

export interface PushResponse {
  isSuccess?: boolean;
  info?: string;
}

export namespace PushResponse {
  export const codec = (): Codec<PushResponse> => {
    return message<PushResponse>({
      1: { name: "isSuccess", codec: bool, optional: true },
      2: { name: "info", codec: string, optional: true },
    });
  };

  export const encode = (obj: PushResponse): Uint8Array => {
    return encodeMessage(obj, PushResponse.codec());
  };

  export const decode = (buf: Uint8Array): PushResponse => {
    return decodeMessage(buf, PushResponse.codec());
  };
}

export interface PushRPC {
  requestId?: string;
  request?: PushRequest;
  response?: PushResponse;
}

export namespace PushRPC {
  export const codec = (): Codec<PushRPC> => {
    return message<PushRPC>({
      1: { name: "requestId", codec: string, optional: true },
      2: { name: "request", codec: PushRequest.codec(), optional: true },
      3: { name: "response", codec: PushResponse.codec(), optional: true },
    });
  };

  export const encode = (obj: PushRPC): Uint8Array => {
    return encodeMessage(obj, PushRPC.codec());
  };

  export const decode = (buf: Uint8Array): PushRPC => {
    return decodeMessage(buf, PushRPC.codec());
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

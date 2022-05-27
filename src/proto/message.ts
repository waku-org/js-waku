/* eslint-disable import/export */
/* eslint-disable @typescript-eslint/no-namespace */

import {
  encodeMessage,
  decodeMessage,
  message,
  bytes,
  string,
  uint32,
  double,
  sint64,
} from "protons-runtime";
import type { Codec } from "protons-runtime";

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

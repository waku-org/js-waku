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
import type { Uint8ArrayList } from "uint8arraylist";

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

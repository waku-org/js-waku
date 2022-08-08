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
import type { Uint8ArrayList } from "uint8arraylist";

export interface FilterRequest {
  subscribe?: boolean;
  topic?: string;
  contentFilters: FilterRequest.ContentFilter[];
}

export namespace FilterRequest {
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

  let _codec: Codec<FilterRequest>;

  export const codec = (): Codec<FilterRequest> => {
    if (_codec == null) {
      _codec = message<FilterRequest>({
        1: { name: "subscribe", codec: bool, optional: true },
        2: { name: "topic", codec: string, optional: true },
        3: {
          name: "contentFilters",
          codec: FilterRequest.ContentFilter.codec(),
          repeats: true,
        },
      });
    }

    return _codec;
  };

  export const encode = (obj: FilterRequest): Uint8ArrayList => {
    return encodeMessage(obj, FilterRequest.codec());
  };

  export const decode = (buf: Uint8Array | Uint8ArrayList): FilterRequest => {
    return decodeMessage(buf, FilterRequest.codec());
  };
}

export interface MessagePush {
  messages: WakuMessage[];
}

export namespace MessagePush {
  let _codec: Codec<MessagePush>;

  export const codec = (): Codec<MessagePush> => {
    if (_codec == null) {
      _codec = message<MessagePush>({
        1: { name: "messages", codec: WakuMessage.codec(), repeats: true },
      });
    }

    return _codec;
  };

  export const encode = (obj: MessagePush): Uint8ArrayList => {
    return encodeMessage(obj, MessagePush.codec());
  };

  export const decode = (buf: Uint8Array | Uint8ArrayList): MessagePush => {
    return decodeMessage(buf, MessagePush.codec());
  };
}

export interface FilterRPC {
  requestId?: string;
  request?: FilterRequest;
  push?: MessagePush;
}

export namespace FilterRPC {
  let _codec: Codec<FilterRPC>;

  export const codec = (): Codec<FilterRPC> => {
    if (_codec == null) {
      _codec = message<FilterRPC>({
        1: { name: "requestId", codec: string, optional: true },
        2: { name: "request", codec: FilterRequest.codec(), optional: true },
        3: { name: "push", codec: MessagePush.codec(), optional: true },
      });
    }

    return _codec;
  };

  export const encode = (obj: FilterRPC): Uint8ArrayList => {
    return encodeMessage(obj, FilterRPC.codec());
  };

  export const decode = (buf: Uint8Array | Uint8ArrayList): FilterRPC => {
    return decodeMessage(buf, FilterRPC.codec());
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

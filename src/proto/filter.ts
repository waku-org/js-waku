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

export interface FilterRequest {
  subscribe: boolean;
  topic: string;
  contentFilters: FilterRequest.ContentFilter[];
}

export namespace FilterRequest {
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

  export const codec = (): Codec<FilterRequest> => {
    return message<FilterRequest>({
      1: { name: "subscribe", codec: bool },
      2: { name: "topic", codec: string },
      3: {
        name: "contentFilters",
        codec: FilterRequest.ContentFilter.codec(),
        repeats: true,
      },
    });
  };

  export const encode = (obj: FilterRequest): Uint8Array => {
    return encodeMessage(obj, FilterRequest.codec());
  };

  export const decode = (buf: Uint8Array): FilterRequest => {
    return decodeMessage(buf, FilterRequest.codec());
  };
}

export interface MessagePush {
  messages: WakuMessage[];
}

export namespace MessagePush {
  export const codec = (): Codec<MessagePush> => {
    return message<MessagePush>({
      1: { name: "messages", codec: WakuMessage.codec(), repeats: true },
    });
  };

  export const encode = (obj: MessagePush): Uint8Array => {
    return encodeMessage(obj, MessagePush.codec());
  };

  export const decode = (buf: Uint8Array): MessagePush => {
    return decodeMessage(buf, MessagePush.codec());
  };
}

export interface FilterRPC {
  requestId: string;
  request?: FilterRequest;
  push?: MessagePush;
}

export namespace FilterRPC {
  export const codec = (): Codec<FilterRPC> => {
    return message<FilterRPC>({
      1: { name: "requestId", codec: string },
      2: { name: "request", codec: FilterRequest.codec(), optional: true },
      3: { name: "push", codec: MessagePush.codec(), optional: true },
    });
  };

  export const encode = (obj: FilterRPC): Uint8Array => {
    return encodeMessage(obj, FilterRPC.codec());
  };

  export const decode = (buf: Uint8Array): FilterRPC => {
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

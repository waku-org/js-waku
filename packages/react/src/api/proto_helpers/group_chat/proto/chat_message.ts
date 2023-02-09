/* eslint-disable import/export */
/* eslint-disable @typescript-eslint/no-namespace */

import { encodeMessage, decodeMessage, message } from "protons-runtime";
import type { Uint8ArrayList } from "uint8arraylist";
import type { Codec } from "protons-runtime";

export interface ChatMessage {
  timestamp: bigint;
  nick: string;
  payload: Uint8Array;
}

export namespace ChatMessage {
  let _codec: Codec<ChatMessage>;

  export const codec = (): Codec<ChatMessage> => {
    if (_codec == null) {
      _codec = message<ChatMessage>(
        (obj, writer, opts = {}) => {
          if (opts.lengthDelimited !== false) {
            writer.fork();
          }

          if (obj.timestamp != null) {
            writer.uint32(8);
            writer.uint64(obj.timestamp);
          } else {
            throw new Error(
              'Protocol error: required field "timestamp" was not found in object'
            );
          }

          if (obj.nick != null) {
            writer.uint32(18);
            writer.string(obj.nick);
          } else {
            throw new Error(
              'Protocol error: required field "nick" was not found in object'
            );
          }

          if (obj.payload != null) {
            writer.uint32(26);
            writer.bytes(obj.payload);
          } else {
            throw new Error(
              'Protocol error: required field "payload" was not found in object'
            );
          }

          if (opts.lengthDelimited !== false) {
            writer.ldelim();
          }
        },
        (reader, length) => {
          const obj: any = {
            timestamp: 0n,
            nick: "",
            payload: new Uint8Array(0),
          };

          const end = length == null ? reader.len : reader.pos + length;

          while (reader.pos < end) {
            const tag = reader.uint32();

            switch (tag >>> 3) {
              case 1:
                obj.timestamp = reader.uint64();
                break;
              case 2:
                obj.nick = reader.string();
                break;
              case 3:
                obj.payload = reader.bytes();
                break;
              default:
                reader.skipType(tag & 7);
                break;
            }
          }

          if (obj.timestamp == null) {
            throw new Error(
              'Protocol error: value for required field "timestamp" was not found in protobuf'
            );
          }

          if (obj.nick == null) {
            throw new Error(
              'Protocol error: value for required field "nick" was not found in protobuf'
            );
          }

          if (obj.payload == null) {
            throw new Error(
              'Protocol error: value for required field "payload" was not found in protobuf'
            );
          }

          return obj;
        }
      );
    }

    return _codec;
  };

  export const encode = (obj: ChatMessage): Uint8Array => {
    return encodeMessage(obj, ChatMessage.codec());
  };

  export const decode = (buf: Uint8Array | Uint8ArrayList): ChatMessage => {
    return decodeMessage(buf, ChatMessage.codec());
  };
}

/* eslint-disable import/export */
/* eslint-disable @typescript-eslint/no-namespace */

import { encodeMessage, decodeMessage, message } from "protons-runtime";
import type { Uint8ArrayList } from "uint8arraylist";
import type { Codec } from "protons-runtime";

export interface TopicOnlyMessage {
  contentTopic?: string;
}

export namespace TopicOnlyMessage {
  let _codec: Codec<TopicOnlyMessage>;

  export const codec = (): Codec<TopicOnlyMessage> => {
    if (_codec == null) {
      _codec = message<TopicOnlyMessage>(
        (obj, writer, opts = {}) => {
          if (opts.lengthDelimited !== false) {
            writer.fork();
          }

          if (obj.contentTopic != null) {
            writer.uint32(18);
            writer.string(obj.contentTopic);
          }

          if (opts.lengthDelimited !== false) {
            writer.ldelim();
          }
        },
        (reader, length) => {
          const obj: any = {};

          const end = length == null ? reader.len : reader.pos + length;

          while (reader.pos < end) {
            const tag = reader.uint32();

            switch (tag >>> 3) {
              case 2:
                obj.contentTopic = reader.string();
                break;
              default:
                reader.skipType(tag & 7);
                break;
            }
          }

          return obj;
        }
      );
    }

    return _codec;
  };

  export const encode = (obj: TopicOnlyMessage): Uint8Array => {
    return encodeMessage(obj, TopicOnlyMessage.codec());
  };

  export const decode = (
    buf: Uint8Array | Uint8ArrayList
  ): TopicOnlyMessage => {
    return decodeMessage(buf, TopicOnlyMessage.codec());
  };
}

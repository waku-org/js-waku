/* eslint-disable import/export */
/* eslint-disable complexity */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-unnecessary-boolean-literal-compare */
/* eslint-disable @typescript-eslint/no-empty-interface */

import { type Codec, decodeMessage, type DecodeOptions, encodeMessage, message } from 'protons-runtime'
import type { Uint8ArrayList } from 'uint8arraylist'

export interface TopicOnlyMessage {
  contentTopic: string
}

export namespace TopicOnlyMessage {
  let _codec: Codec<TopicOnlyMessage>

  export const codec = (): Codec<TopicOnlyMessage> => {
    if (_codec == null) {
      _codec = message<TopicOnlyMessage>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if ((obj.contentTopic != null && obj.contentTopic !== '')) {
          w.uint32(18)
          w.string(obj.contentTopic)
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length, opts = {}) => {
        const obj: any = {
          contentTopic: ''
        }

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 2: {
              obj.contentTopic = reader.string()
              break
            }
            default: {
              reader.skipType(tag & 7)
              break
            }
          }
        }

        return obj
      })
    }

    return _codec
  }

  export const encode = (obj: Partial<TopicOnlyMessage>): Uint8Array => {
    return encodeMessage(obj, TopicOnlyMessage.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList, opts?: DecodeOptions<TopicOnlyMessage>): TopicOnlyMessage => {
    return decodeMessage(buf, TopicOnlyMessage.codec(), opts)
  }
}

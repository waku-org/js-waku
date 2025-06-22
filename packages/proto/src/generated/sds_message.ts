/* eslint-disable import/export */
/* eslint-disable complexity */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-unnecessary-boolean-literal-compare */
/* eslint-disable @typescript-eslint/no-empty-interface */
/* eslint-disable import/consistent-type-specifier-style */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { decodeMessage, encodeMessage, MaxLengthError, message } from 'protons-runtime'
import type { Codec, DecodeOptions } from 'protons-runtime'
import type { Uint8ArrayList } from 'uint8arraylist'

export interface HistoryEntry {
  messageId: string
  retrievalHint?: Uint8Array
}

export namespace HistoryEntry {
  let _codec: Codec<HistoryEntry>

  export const codec = (): Codec<HistoryEntry> => {
    if (_codec == null) {
      _codec = message<HistoryEntry>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if ((obj.messageId != null && obj.messageId !== '')) {
          w.uint32(10)
          w.string(obj.messageId)
        }

        if (obj.retrievalHint != null) {
          w.uint32(18)
          w.bytes(obj.retrievalHint)
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length, opts = {}) => {
        const obj: any = {
          messageId: ''
        }

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 1: {
              obj.messageId = reader.string()
              break
            }
            case 2: {
              obj.retrievalHint = reader.bytes()
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

  export const encode = (obj: Partial<HistoryEntry>): Uint8Array => {
    return encodeMessage(obj, HistoryEntry.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList, opts?: DecodeOptions<HistoryEntry>): HistoryEntry => {
    return decodeMessage(buf, HistoryEntry.codec(), opts)
  }
}

export interface SdsMessage {
  messageId: string
  channelId: string
  lamportTimestamp?: number
  causalHistory: HistoryEntry[]
  bloomFilter?: Uint8Array
  content?: Uint8Array
}

export namespace SdsMessage {
  let _codec: Codec<SdsMessage>

  export const codec = (): Codec<SdsMessage> => {
    if (_codec == null) {
      _codec = message<SdsMessage>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if ((obj.messageId != null && obj.messageId !== '')) {
          w.uint32(18)
          w.string(obj.messageId)
        }

        if ((obj.channelId != null && obj.channelId !== '')) {
          w.uint32(26)
          w.string(obj.channelId)
        }

        if (obj.lamportTimestamp != null) {
          w.uint32(80)
          w.int32(obj.lamportTimestamp)
        }

        if (obj.causalHistory != null) {
          for (const value of obj.causalHistory) {
            w.uint32(90)
            HistoryEntry.codec().encode(value, w)
          }
        }

        if (obj.bloomFilter != null) {
          w.uint32(98)
          w.bytes(obj.bloomFilter)
        }

        if (obj.content != null) {
          w.uint32(162)
          w.bytes(obj.content)
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length, opts = {}) => {
        const obj: any = {
          messageId: '',
          channelId: '',
          causalHistory: []
        }

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 2: {
              obj.messageId = reader.string()
              break
            }
            case 3: {
              obj.channelId = reader.string()
              break
            }
            case 10: {
              obj.lamportTimestamp = reader.int32()
              break
            }
            case 11: {
              if (opts.limits?.causalHistory != null && obj.causalHistory.length === opts.limits.causalHistory) {
                throw new MaxLengthError('Decode error - map field "causalHistory" had too many elements')
              }

              obj.causalHistory.push(HistoryEntry.codec().decode(reader, reader.uint32(), {
                limits: opts.limits?.causalHistory$
              }))
              break
            }
            case 12: {
              obj.bloomFilter = reader.bytes()
              break
            }
            case 20: {
              obj.content = reader.bytes()
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

  export const encode = (obj: Partial<SdsMessage>): Uint8Array => {
    return encodeMessage(obj, SdsMessage.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList, opts?: DecodeOptions<SdsMessage>): SdsMessage => {
    return decodeMessage(buf, SdsMessage.codec(), opts)
  }
}

/* eslint-disable import/export */
/* eslint-disable complexity */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-unnecessary-boolean-literal-compare */
/* eslint-disable @typescript-eslint/no-empty-interface */
/* eslint-disable import/consistent-type-specifier-style */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { decodeMessage, encodeMessage, MaxLengthError, message } from 'protons-runtime'
import { alloc as uint8ArrayAlloc } from 'uint8arrays/alloc'
import type { Codec, DecodeOptions } from 'protons-runtime'
import type { Uint8ArrayList } from 'uint8arraylist'

export interface FilterRequest {
  subscribe: boolean
  topic: string
  contentFilters: FilterRequest.ContentFilter[]
}

export namespace FilterRequest {
  export interface ContentFilter {
    contentTopic: string
  }

  export namespace ContentFilter {
    let _codec: Codec<ContentFilter>

    export const codec = (): Codec<ContentFilter> => {
      if (_codec == null) {
        _codec = message<ContentFilter>((obj, w, opts = {}) => {
          if (opts.lengthDelimited !== false) {
            w.fork()
          }

          if ((obj.contentTopic != null && obj.contentTopic !== '')) {
            w.uint32(10)
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
              case 1: {
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

    export const encode = (obj: Partial<ContentFilter>): Uint8Array => {
      return encodeMessage(obj, ContentFilter.codec())
    }

    export const decode = (buf: Uint8Array | Uint8ArrayList, opts?: DecodeOptions<ContentFilter>): ContentFilter => {
      return decodeMessage(buf, ContentFilter.codec(), opts)
    }
  }

  let _codec: Codec<FilterRequest>

  export const codec = (): Codec<FilterRequest> => {
    if (_codec == null) {
      _codec = message<FilterRequest>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if ((obj.subscribe != null && obj.subscribe !== false)) {
          w.uint32(8)
          w.bool(obj.subscribe)
        }

        if ((obj.topic != null && obj.topic !== '')) {
          w.uint32(18)
          w.string(obj.topic)
        }

        if (obj.contentFilters != null) {
          for (const value of obj.contentFilters) {
            w.uint32(26)
            FilterRequest.ContentFilter.codec().encode(value, w)
          }
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length, opts = {}) => {
        const obj: any = {
          subscribe: false,
          topic: '',
          contentFilters: []
        }

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 1: {
              obj.subscribe = reader.bool()
              break
            }
            case 2: {
              obj.topic = reader.string()
              break
            }
            case 3: {
              if (opts.limits?.contentFilters != null && obj.contentFilters.length === opts.limits.contentFilters) {
                throw new MaxLengthError('Decode error - map field "contentFilters" had too many elements')
              }

              obj.contentFilters.push(FilterRequest.ContentFilter.codec().decode(reader, reader.uint32(), {
                limits: opts.limits?.contentFilters$
              }))
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

  export const encode = (obj: Partial<FilterRequest>): Uint8Array => {
    return encodeMessage(obj, FilterRequest.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList, opts?: DecodeOptions<FilterRequest>): FilterRequest => {
    return decodeMessage(buf, FilterRequest.codec(), opts)
  }
}

export interface MessagePush {
  messages: WakuMessage[]
}

export namespace MessagePush {
  let _codec: Codec<MessagePush>

  export const codec = (): Codec<MessagePush> => {
    if (_codec == null) {
      _codec = message<MessagePush>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if (obj.messages != null) {
          for (const value of obj.messages) {
            w.uint32(10)
            WakuMessage.codec().encode(value, w)
          }
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length, opts = {}) => {
        const obj: any = {
          messages: []
        }

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 1: {
              if (opts.limits?.messages != null && obj.messages.length === opts.limits.messages) {
                throw new MaxLengthError('Decode error - map field "messages" had too many elements')
              }

              obj.messages.push(WakuMessage.codec().decode(reader, reader.uint32(), {
                limits: opts.limits?.messages$
              }))
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

  export const encode = (obj: Partial<MessagePush>): Uint8Array => {
    return encodeMessage(obj, MessagePush.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList, opts?: DecodeOptions<MessagePush>): MessagePush => {
    return decodeMessage(buf, MessagePush.codec(), opts)
  }
}

export interface FilterRpc {
  requestId: string
  request?: FilterRequest
  push?: MessagePush
}

export namespace FilterRpc {
  let _codec: Codec<FilterRpc>

  export const codec = (): Codec<FilterRpc> => {
    if (_codec == null) {
      _codec = message<FilterRpc>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if ((obj.requestId != null && obj.requestId !== '')) {
          w.uint32(10)
          w.string(obj.requestId)
        }

        if (obj.request != null) {
          w.uint32(18)
          FilterRequest.codec().encode(obj.request, w)
        }

        if (obj.push != null) {
          w.uint32(26)
          MessagePush.codec().encode(obj.push, w)
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length, opts = {}) => {
        const obj: any = {
          requestId: ''
        }

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 1: {
              obj.requestId = reader.string()
              break
            }
            case 2: {
              obj.request = FilterRequest.codec().decode(reader, reader.uint32(), {
                limits: opts.limits?.request
              })
              break
            }
            case 3: {
              obj.push = MessagePush.codec().decode(reader, reader.uint32(), {
                limits: opts.limits?.push
              })
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

  export const encode = (obj: Partial<FilterRpc>): Uint8Array => {
    return encodeMessage(obj, FilterRpc.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList, opts?: DecodeOptions<FilterRpc>): FilterRpc => {
    return decodeMessage(buf, FilterRpc.codec(), opts)
  }
}

export interface RateLimitProof {
  proof: Uint8Array
  merkleRoot: Uint8Array
  epoch: Uint8Array
  shareX: Uint8Array
  shareY: Uint8Array
  nullifier: Uint8Array
  rlnIdentifier: Uint8Array
}

export namespace RateLimitProof {
  let _codec: Codec<RateLimitProof>

  export const codec = (): Codec<RateLimitProof> => {
    if (_codec == null) {
      _codec = message<RateLimitProof>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if ((obj.proof != null && obj.proof.byteLength > 0)) {
          w.uint32(10)
          w.bytes(obj.proof)
        }

        if ((obj.merkleRoot != null && obj.merkleRoot.byteLength > 0)) {
          w.uint32(18)
          w.bytes(obj.merkleRoot)
        }

        if ((obj.epoch != null && obj.epoch.byteLength > 0)) {
          w.uint32(26)
          w.bytes(obj.epoch)
        }

        if ((obj.shareX != null && obj.shareX.byteLength > 0)) {
          w.uint32(34)
          w.bytes(obj.shareX)
        }

        if ((obj.shareY != null && obj.shareY.byteLength > 0)) {
          w.uint32(42)
          w.bytes(obj.shareY)
        }

        if ((obj.nullifier != null && obj.nullifier.byteLength > 0)) {
          w.uint32(50)
          w.bytes(obj.nullifier)
        }

        if ((obj.rlnIdentifier != null && obj.rlnIdentifier.byteLength > 0)) {
          w.uint32(58)
          w.bytes(obj.rlnIdentifier)
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length, opts = {}) => {
        const obj: any = {
          proof: uint8ArrayAlloc(0),
          merkleRoot: uint8ArrayAlloc(0),
          epoch: uint8ArrayAlloc(0),
          shareX: uint8ArrayAlloc(0),
          shareY: uint8ArrayAlloc(0),
          nullifier: uint8ArrayAlloc(0),
          rlnIdentifier: uint8ArrayAlloc(0)
        }

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 1: {
              obj.proof = reader.bytes()
              break
            }
            case 2: {
              obj.merkleRoot = reader.bytes()
              break
            }
            case 3: {
              obj.epoch = reader.bytes()
              break
            }
            case 4: {
              obj.shareX = reader.bytes()
              break
            }
            case 5: {
              obj.shareY = reader.bytes()
              break
            }
            case 6: {
              obj.nullifier = reader.bytes()
              break
            }
            case 7: {
              obj.rlnIdentifier = reader.bytes()
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

  export const encode = (obj: Partial<RateLimitProof>): Uint8Array => {
    return encodeMessage(obj, RateLimitProof.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList, opts?: DecodeOptions<RateLimitProof>): RateLimitProof => {
    return decodeMessage(buf, RateLimitProof.codec(), opts)
  }
}

export interface WakuMessage {
  payload: Uint8Array
  contentTopic: string
  version?: number
  timestamp?: bigint
  meta?: Uint8Array
  rateLimitProof?: RateLimitProof
  ephemeral?: boolean
}

export namespace WakuMessage {
  let _codec: Codec<WakuMessage>

  export const codec = (): Codec<WakuMessage> => {
    if (_codec == null) {
      _codec = message<WakuMessage>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if ((obj.payload != null && obj.payload.byteLength > 0)) {
          w.uint32(10)
          w.bytes(obj.payload)
        }

        if ((obj.contentTopic != null && obj.contentTopic !== '')) {
          w.uint32(18)
          w.string(obj.contentTopic)
        }

        if (obj.version != null) {
          w.uint32(24)
          w.uint32(obj.version)
        }

        if (obj.timestamp != null) {
          w.uint32(80)
          w.sint64(obj.timestamp)
        }

        if (obj.meta != null) {
          w.uint32(90)
          w.bytes(obj.meta)
        }

        if (obj.rateLimitProof != null) {
          w.uint32(170)
          RateLimitProof.codec().encode(obj.rateLimitProof, w)
        }

        if (obj.ephemeral != null) {
          w.uint32(248)
          w.bool(obj.ephemeral)
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length, opts = {}) => {
        const obj: any = {
          payload: uint8ArrayAlloc(0),
          contentTopic: ''
        }

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 1: {
              obj.payload = reader.bytes()
              break
            }
            case 2: {
              obj.contentTopic = reader.string()
              break
            }
            case 3: {
              obj.version = reader.uint32()
              break
            }
            case 10: {
              obj.timestamp = reader.sint64()
              break
            }
            case 11: {
              obj.meta = reader.bytes()
              break
            }
            case 21: {
              obj.rateLimitProof = RateLimitProof.codec().decode(reader, reader.uint32(), {
                limits: opts.limits?.rateLimitProof
              })
              break
            }
            case 31: {
              obj.ephemeral = reader.bool()
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

  export const encode = (obj: Partial<WakuMessage>): Uint8Array => {
    return encodeMessage(obj, WakuMessage.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList, opts?: DecodeOptions<WakuMessage>): WakuMessage => {
    return decodeMessage(buf, WakuMessage.codec(), opts)
  }
}

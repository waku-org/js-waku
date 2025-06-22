/* eslint-disable import/export */
/* eslint-disable complexity */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-unnecessary-boolean-literal-compare */
/* eslint-disable @typescript-eslint/no-empty-interface */
/* eslint-disable import/consistent-type-specifier-style */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { decodeMessage, encodeMessage, enumeration, MaxLengthError, message } from 'protons-runtime'
import { alloc as uint8ArrayAlloc } from 'uint8arrays/alloc'
import type { Codec, DecodeOptions } from 'protons-runtime'
import type { Uint8ArrayList } from 'uint8arraylist'

export interface FilterSubscribeRequest {
  requestId: string
  filterSubscribeType: FilterSubscribeRequest.FilterSubscribeType
  pubsubTopic?: string
  contentTopics: string[]
}

export namespace FilterSubscribeRequest {
  export enum FilterSubscribeType {
    SUBSCRIBER_PING = 'SUBSCRIBER_PING',
    SUBSCRIBE = 'SUBSCRIBE',
    UNSUBSCRIBE = 'UNSUBSCRIBE',
    UNSUBSCRIBE_ALL = 'UNSUBSCRIBE_ALL'
  }

  enum __FilterSubscribeTypeValues {
    SUBSCRIBER_PING = 0,
    SUBSCRIBE = 1,
    UNSUBSCRIBE = 2,
    UNSUBSCRIBE_ALL = 3
  }

  export namespace FilterSubscribeType {
    export const codec = (): Codec<FilterSubscribeType> => {
      return enumeration<FilterSubscribeType>(__FilterSubscribeTypeValues)
    }
  }

  let _codec: Codec<FilterSubscribeRequest>

  export const codec = (): Codec<FilterSubscribeRequest> => {
    if (_codec == null) {
      _codec = message<FilterSubscribeRequest>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if ((obj.requestId != null && obj.requestId !== '')) {
          w.uint32(10)
          w.string(obj.requestId)
        }

        if (obj.filterSubscribeType != null && __FilterSubscribeTypeValues[obj.filterSubscribeType] !== 0) {
          w.uint32(16)
          FilterSubscribeRequest.FilterSubscribeType.codec().encode(obj.filterSubscribeType, w)
        }

        if (obj.pubsubTopic != null) {
          w.uint32(82)
          w.string(obj.pubsubTopic)
        }

        if (obj.contentTopics != null) {
          for (const value of obj.contentTopics) {
            w.uint32(90)
            w.string(value)
          }
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length, opts = {}) => {
        const obj: any = {
          requestId: '',
          filterSubscribeType: FilterSubscribeType.SUBSCRIBER_PING,
          contentTopics: []
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
              obj.filterSubscribeType = FilterSubscribeRequest.FilterSubscribeType.codec().decode(reader)
              break
            }
            case 10: {
              obj.pubsubTopic = reader.string()
              break
            }
            case 11: {
              if (opts.limits?.contentTopics != null && obj.contentTopics.length === opts.limits.contentTopics) {
                throw new MaxLengthError('Decode error - map field "contentTopics" had too many elements')
              }

              obj.contentTopics.push(reader.string())
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

  export const encode = (obj: Partial<FilterSubscribeRequest>): Uint8Array => {
    return encodeMessage(obj, FilterSubscribeRequest.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList, opts?: DecodeOptions<FilterSubscribeRequest>): FilterSubscribeRequest => {
    return decodeMessage(buf, FilterSubscribeRequest.codec(), opts)
  }
}

export interface FilterSubscribeResponse {
  requestId: string
  statusCode: number
  statusDesc?: string
}

export namespace FilterSubscribeResponse {
  let _codec: Codec<FilterSubscribeResponse>

  export const codec = (): Codec<FilterSubscribeResponse> => {
    if (_codec == null) {
      _codec = message<FilterSubscribeResponse>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if ((obj.requestId != null && obj.requestId !== '')) {
          w.uint32(10)
          w.string(obj.requestId)
        }

        if ((obj.statusCode != null && obj.statusCode !== 0)) {
          w.uint32(80)
          w.uint32(obj.statusCode)
        }

        if (obj.statusDesc != null) {
          w.uint32(90)
          w.string(obj.statusDesc)
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length, opts = {}) => {
        const obj: any = {
          requestId: '',
          statusCode: 0
        }

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 1: {
              obj.requestId = reader.string()
              break
            }
            case 10: {
              obj.statusCode = reader.uint32()
              break
            }
            case 11: {
              obj.statusDesc = reader.string()
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

  export const encode = (obj: Partial<FilterSubscribeResponse>): Uint8Array => {
    return encodeMessage(obj, FilterSubscribeResponse.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList, opts?: DecodeOptions<FilterSubscribeResponse>): FilterSubscribeResponse => {
    return decodeMessage(buf, FilterSubscribeResponse.codec(), opts)
  }
}

export interface MessagePush {
  wakuMessage?: WakuMessage
  pubsubTopic?: string
}

export namespace MessagePush {
  let _codec: Codec<MessagePush>

  export const codec = (): Codec<MessagePush> => {
    if (_codec == null) {
      _codec = message<MessagePush>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if (obj.wakuMessage != null) {
          w.uint32(10)
          WakuMessage.codec().encode(obj.wakuMessage, w)
        }

        if (obj.pubsubTopic != null) {
          w.uint32(18)
          w.string(obj.pubsubTopic)
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length, opts = {}) => {
        const obj: any = {}

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 1: {
              obj.wakuMessage = WakuMessage.codec().decode(reader, reader.uint32(), {
                limits: opts.limits?.wakuMessage
              })
              break
            }
            case 2: {
              obj.pubsubTopic = reader.string()
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

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

export interface WakuMessageKeyValue {
  messageHash?: Uint8Array
  message?: WakuMessage
  pubsubTopic?: string
}

export namespace WakuMessageKeyValue {
  let _codec: Codec<WakuMessageKeyValue>

  export const codec = (): Codec<WakuMessageKeyValue> => {
    if (_codec == null) {
      _codec = message<WakuMessageKeyValue>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if (obj.messageHash != null) {
          w.uint32(10)
          w.bytes(obj.messageHash)
        }

        if (obj.message != null) {
          w.uint32(18)
          WakuMessage.codec().encode(obj.message, w)
        }

        if (obj.pubsubTopic != null) {
          w.uint32(26)
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
              obj.messageHash = reader.bytes()
              break
            }
            case 2: {
              obj.message = WakuMessage.codec().decode(reader, reader.uint32(), {
                limits: opts.limits?.message
              })
              break
            }
            case 3: {
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

  export const encode = (obj: Partial<WakuMessageKeyValue>): Uint8Array => {
    return encodeMessage(obj, WakuMessageKeyValue.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList, opts?: DecodeOptions<WakuMessageKeyValue>): WakuMessageKeyValue => {
    return decodeMessage(buf, WakuMessageKeyValue.codec(), opts)
  }
}

export interface StoreQueryRequest {
  requestId: string
  includeData: boolean
  pubsubTopic?: string
  contentTopics: string[]
  timeStart?: bigint
  timeEnd?: bigint
  messageHashes: Uint8Array[]
  paginationCursor?: Uint8Array
  paginationForward: boolean
  paginationLimit?: bigint
}

export namespace StoreQueryRequest {
  let _codec: Codec<StoreQueryRequest>

  export const codec = (): Codec<StoreQueryRequest> => {
    if (_codec == null) {
      _codec = message<StoreQueryRequest>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if ((obj.requestId != null && obj.requestId !== '')) {
          w.uint32(10)
          w.string(obj.requestId)
        }

        if ((obj.includeData != null && obj.includeData !== false)) {
          w.uint32(16)
          w.bool(obj.includeData)
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

        if (obj.timeStart != null) {
          w.uint32(96)
          w.sint64(obj.timeStart)
        }

        if (obj.timeEnd != null) {
          w.uint32(104)
          w.sint64(obj.timeEnd)
        }

        if (obj.messageHashes != null) {
          for (const value of obj.messageHashes) {
            w.uint32(162)
            w.bytes(value)
          }
        }

        if (obj.paginationCursor != null) {
          w.uint32(410)
          w.bytes(obj.paginationCursor)
        }

        if ((obj.paginationForward != null && obj.paginationForward !== false)) {
          w.uint32(416)
          w.bool(obj.paginationForward)
        }

        if (obj.paginationLimit != null) {
          w.uint32(424)
          w.uint64(obj.paginationLimit)
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length, opts = {}) => {
        const obj: any = {
          requestId: '',
          includeData: false,
          contentTopics: [],
          messageHashes: [],
          paginationForward: false
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
              obj.includeData = reader.bool()
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
            case 12: {
              obj.timeStart = reader.sint64()
              break
            }
            case 13: {
              obj.timeEnd = reader.sint64()
              break
            }
            case 20: {
              if (opts.limits?.messageHashes != null && obj.messageHashes.length === opts.limits.messageHashes) {
                throw new MaxLengthError('Decode error - map field "messageHashes" had too many elements')
              }

              obj.messageHashes.push(reader.bytes())
              break
            }
            case 51: {
              obj.paginationCursor = reader.bytes()
              break
            }
            case 52: {
              obj.paginationForward = reader.bool()
              break
            }
            case 53: {
              obj.paginationLimit = reader.uint64()
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

  export const encode = (obj: Partial<StoreQueryRequest>): Uint8Array => {
    return encodeMessage(obj, StoreQueryRequest.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList, opts?: DecodeOptions<StoreQueryRequest>): StoreQueryRequest => {
    return decodeMessage(buf, StoreQueryRequest.codec(), opts)
  }
}

export interface StoreQueryResponse {
  requestId: string
  statusCode?: number
  statusDesc?: string
  messages: WakuMessageKeyValue[]
  paginationCursor?: Uint8Array
}

export namespace StoreQueryResponse {
  let _codec: Codec<StoreQueryResponse>

  export const codec = (): Codec<StoreQueryResponse> => {
    if (_codec == null) {
      _codec = message<StoreQueryResponse>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if ((obj.requestId != null && obj.requestId !== '')) {
          w.uint32(10)
          w.string(obj.requestId)
        }

        if (obj.statusCode != null) {
          w.uint32(80)
          w.uint32(obj.statusCode)
        }

        if (obj.statusDesc != null) {
          w.uint32(90)
          w.string(obj.statusDesc)
        }

        if (obj.messages != null) {
          for (const value of obj.messages) {
            w.uint32(162)
            WakuMessageKeyValue.codec().encode(value, w)
          }
        }

        if (obj.paginationCursor != null) {
          w.uint32(410)
          w.bytes(obj.paginationCursor)
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length, opts = {}) => {
        const obj: any = {
          requestId: '',
          messages: []
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
            case 20: {
              if (opts.limits?.messages != null && obj.messages.length === opts.limits.messages) {
                throw new MaxLengthError('Decode error - map field "messages" had too many elements')
              }

              obj.messages.push(WakuMessageKeyValue.codec().decode(reader, reader.uint32(), {
                limits: opts.limits?.messages$
              }))
              break
            }
            case 51: {
              obj.paginationCursor = reader.bytes()
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

  export const encode = (obj: Partial<StoreQueryResponse>): Uint8Array => {
    return encodeMessage(obj, StoreQueryResponse.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList, opts?: DecodeOptions<StoreQueryResponse>): StoreQueryResponse => {
    return decodeMessage(buf, StoreQueryResponse.codec(), opts)
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

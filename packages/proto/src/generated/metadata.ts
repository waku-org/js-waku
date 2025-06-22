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

export interface WakuMetadataRequest {
  clusterId?: number
  shards: number[]
}

export namespace WakuMetadataRequest {
  let _codec: Codec<WakuMetadataRequest>

  export const codec = (): Codec<WakuMetadataRequest> => {
    if (_codec == null) {
      _codec = message<WakuMetadataRequest>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if (obj.clusterId != null) {
          w.uint32(8)
          w.uint32(obj.clusterId)
        }

        if (obj.shards != null) {
          for (const value of obj.shards) {
            w.uint32(16)
            w.uint32(value)
          }
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length, opts = {}) => {
        const obj: any = {
          shards: []
        }

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 1: {
              obj.clusterId = reader.uint32()
              break
            }
            case 2: {
              if (opts.limits?.shards != null && obj.shards.length === opts.limits.shards) {
                throw new MaxLengthError('Decode error - map field "shards" had too many elements')
              }

              obj.shards.push(reader.uint32())
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

  export const encode = (obj: Partial<WakuMetadataRequest>): Uint8Array => {
    return encodeMessage(obj, WakuMetadataRequest.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList, opts?: DecodeOptions<WakuMetadataRequest>): WakuMetadataRequest => {
    return decodeMessage(buf, WakuMetadataRequest.codec(), opts)
  }
}

export interface WakuMetadataResponse {
  clusterId?: number
  shards: number[]
}

export namespace WakuMetadataResponse {
  let _codec: Codec<WakuMetadataResponse>

  export const codec = (): Codec<WakuMetadataResponse> => {
    if (_codec == null) {
      _codec = message<WakuMetadataResponse>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if (obj.clusterId != null) {
          w.uint32(8)
          w.uint32(obj.clusterId)
        }

        if (obj.shards != null) {
          for (const value of obj.shards) {
            w.uint32(16)
            w.uint32(value)
          }
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length, opts = {}) => {
        const obj: any = {
          shards: []
        }

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 1: {
              obj.clusterId = reader.uint32()
              break
            }
            case 2: {
              if (opts.limits?.shards != null && obj.shards.length === opts.limits.shards) {
                throw new MaxLengthError('Decode error - map field "shards" had too many elements')
              }

              obj.shards.push(reader.uint32())
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

  export const encode = (obj: Partial<WakuMetadataResponse>): Uint8Array => {
    return encodeMessage(obj, WakuMetadataResponse.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList, opts?: DecodeOptions<WakuMetadataResponse>): WakuMetadataResponse => {
    return decodeMessage(buf, WakuMetadataResponse.codec(), opts)
  }
}

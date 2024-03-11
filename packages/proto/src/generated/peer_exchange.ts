/* eslint-disable import/export */
/* eslint-disable complexity */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-unnecessary-boolean-literal-compare */
/* eslint-disable @typescript-eslint/no-empty-interface */

import { type Codec, CodeError, decodeMessage, type DecodeOptions, encodeMessage, message } from 'protons-runtime'
import type { Uint8ArrayList } from 'uint8arraylist'

export interface PeerInfo {
  enr?: Uint8Array
}

export namespace PeerInfo {
  let _codec: Codec<PeerInfo>

  export const codec = (): Codec<PeerInfo> => {
    if (_codec == null) {
      _codec = message<PeerInfo>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if (obj.enr != null) {
          w.uint32(10)
          w.bytes(obj.enr)
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
              obj.enr = reader.bytes()
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

  export const encode = (obj: Partial<PeerInfo>): Uint8Array => {
    return encodeMessage(obj, PeerInfo.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList, opts?: DecodeOptions<PeerInfo>): PeerInfo => {
    return decodeMessage(buf, PeerInfo.codec(), opts)
  }
}

export interface PeerExchangeQuery {
  numPeers?: bigint
}

export namespace PeerExchangeQuery {
  let _codec: Codec<PeerExchangeQuery>

  export const codec = (): Codec<PeerExchangeQuery> => {
    if (_codec == null) {
      _codec = message<PeerExchangeQuery>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if (obj.numPeers != null) {
          w.uint32(8)
          w.uint64(obj.numPeers)
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
              obj.numPeers = reader.uint64()
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

  export const encode = (obj: Partial<PeerExchangeQuery>): Uint8Array => {
    return encodeMessage(obj, PeerExchangeQuery.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList, opts?: DecodeOptions<PeerExchangeQuery>): PeerExchangeQuery => {
    return decodeMessage(buf, PeerExchangeQuery.codec(), opts)
  }
}

export interface PeerExchangeResponse {
  peerInfos: PeerInfo[]
}

export namespace PeerExchangeResponse {
  let _codec: Codec<PeerExchangeResponse>

  export const codec = (): Codec<PeerExchangeResponse> => {
    if (_codec == null) {
      _codec = message<PeerExchangeResponse>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if (obj.peerInfos != null) {
          for (const value of obj.peerInfos) {
            w.uint32(10)
            PeerInfo.codec().encode(value, w)
          }
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length, opts = {}) => {
        const obj: any = {
          peerInfos: []
        }

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 1: {
              if (opts.limits?.peerInfos != null && obj.peerInfos.length === opts.limits.peerInfos) {
                throw new CodeError('decode error - map field "peerInfos" had too many elements', 'ERR_MAX_LENGTH')
              }

              obj.peerInfos.push(PeerInfo.codec().decode(reader, reader.uint32(), {
                limits: opts.limits?.peerInfos$
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

  export const encode = (obj: Partial<PeerExchangeResponse>): Uint8Array => {
    return encodeMessage(obj, PeerExchangeResponse.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList, opts?: DecodeOptions<PeerExchangeResponse>): PeerExchangeResponse => {
    return decodeMessage(buf, PeerExchangeResponse.codec(), opts)
  }
}

export interface PeerExchangeRPC {
  query?: PeerExchangeQuery
  response?: PeerExchangeResponse
}

export namespace PeerExchangeRPC {
  let _codec: Codec<PeerExchangeRPC>

  export const codec = (): Codec<PeerExchangeRPC> => {
    if (_codec == null) {
      _codec = message<PeerExchangeRPC>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if (obj.query != null) {
          w.uint32(10)
          PeerExchangeQuery.codec().encode(obj.query, w)
        }

        if (obj.response != null) {
          w.uint32(18)
          PeerExchangeResponse.codec().encode(obj.response, w)
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
              obj.query = PeerExchangeQuery.codec().decode(reader, reader.uint32(), {
                limits: opts.limits?.query
              })
              break
            }
            case 2: {
              obj.response = PeerExchangeResponse.codec().decode(reader, reader.uint32(), {
                limits: opts.limits?.response
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

  export const encode = (obj: Partial<PeerExchangeRPC>): Uint8Array => {
    return encodeMessage(obj, PeerExchangeRPC.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList, opts?: DecodeOptions<PeerExchangeRPC>): PeerExchangeRPC => {
    return decodeMessage(buf, PeerExchangeRPC.codec(), opts)
  }
}

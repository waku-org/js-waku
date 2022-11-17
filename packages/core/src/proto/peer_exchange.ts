/* eslint-disable import/export */
/* eslint-disable @typescript-eslint/no-namespace */

import { encodeMessage, decodeMessage, message } from "protons-runtime";
import type { Uint8ArrayList } from "uint8arraylist";
import type { Codec } from "protons-runtime";

export interface PeerInfo {
  ENR: Uint8Array;
}

export namespace PeerInfo {
  let _codec: Codec<PeerInfo>;

  export const codec = (): Codec<PeerInfo> => {
    if (_codec == null) {
      _codec = message<PeerInfo>(
        (obj, writer, opts = {}) => {
          if (opts.lengthDelimited !== false) {
            writer.fork();
          }

          if (obj.ENR != null) {
            writer.uint32(10);
            writer.bytes(obj.ENR);
          } else {
            throw new Error(
              'Protocol error: required field "ENR" was not found in object'
            );
          }

          if (opts.lengthDelimited !== false) {
            writer.ldelim();
          }
        },
        (reader, length) => {
          const obj: any = {
            ENR: new Uint8Array(0),
          };

          const end = length == null ? reader.len : reader.pos + length;

          while (reader.pos < end) {
            const tag = reader.uint32();

            switch (tag >>> 3) {
              case 1:
                obj.ENR = reader.bytes();
                break;
              default:
                reader.skipType(tag & 7);
                break;
            }
          }

          if (obj.ENR == null) {
            throw new Error(
              'Protocol error: value for required field "ENR" was not found in protobuf'
            );
          }

          return obj;
        }
      );
    }

    return _codec;
  };

  export const encode = (obj: PeerInfo): Uint8Array => {
    return encodeMessage(obj, PeerInfo.codec());
  };

  export const decode = (buf: Uint8Array | Uint8ArrayList): PeerInfo => {
    return decodeMessage(buf, PeerInfo.codec());
  };
}

export interface PeerExchangeQuery {
  numPeers: bigint;
}

export namespace PeerExchangeQuery {
  let _codec: Codec<PeerExchangeQuery>;

  export const codec = (): Codec<PeerExchangeQuery> => {
    if (_codec == null) {
      _codec = message<PeerExchangeQuery>(
        (obj, writer, opts = {}) => {
          if (opts.lengthDelimited !== false) {
            writer.fork();
          }

          if (obj.numPeers != null) {
            writer.uint32(8);
            writer.uint64(obj.numPeers);
          } else {
            throw new Error(
              'Protocol error: required field "numPeers" was not found in object'
            );
          }

          if (opts.lengthDelimited !== false) {
            writer.ldelim();
          }
        },
        (reader, length) => {
          const obj: any = {
            numPeers: 0n,
          };

          const end = length == null ? reader.len : reader.pos + length;

          while (reader.pos < end) {
            const tag = reader.uint32();

            switch (tag >>> 3) {
              case 1:
                obj.numPeers = reader.uint64();
                break;
              default:
                reader.skipType(tag & 7);
                break;
            }
          }

          if (obj.numPeers == null) {
            throw new Error(
              'Protocol error: value for required field "numPeers" was not found in protobuf'
            );
          }

          return obj;
        }
      );
    }

    return _codec;
  };

  export const encode = (obj: PeerExchangeQuery): Uint8Array => {
    return encodeMessage(obj, PeerExchangeQuery.codec());
  };

  export const decode = (
    buf: Uint8Array | Uint8ArrayList
  ): PeerExchangeQuery => {
    return decodeMessage(buf, PeerExchangeQuery.codec());
  };
}

export interface PeerExchangeResponse {
  peerInfos: PeerInfo[];
}

export namespace PeerExchangeResponse {
  let _codec: Codec<PeerExchangeResponse>;

  export const codec = (): Codec<PeerExchangeResponse> => {
    if (_codec == null) {
      _codec = message<PeerExchangeResponse>(
        (obj, writer, opts = {}) => {
          if (opts.lengthDelimited !== false) {
            writer.fork();
          }

          if (obj.peerInfos != null) {
            for (const value of obj.peerInfos) {
              writer.uint32(10);
              PeerInfo.codec().encode(value, writer);
            }
          } else {
            throw new Error(
              'Protocol error: required field "peerInfos" was not found in object'
            );
          }

          if (opts.lengthDelimited !== false) {
            writer.ldelim();
          }
        },
        (reader, length) => {
          const obj: any = {
            peerInfos: [],
          };

          const end = length == null ? reader.len : reader.pos + length;

          while (reader.pos < end) {
            const tag = reader.uint32();

            switch (tag >>> 3) {
              case 1:
                obj.peerInfos.push(
                  PeerInfo.codec().decode(reader, reader.uint32())
                );
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

  export const encode = (obj: PeerExchangeResponse): Uint8Array => {
    return encodeMessage(obj, PeerExchangeResponse.codec());
  };

  export const decode = (
    buf: Uint8Array | Uint8ArrayList
  ): PeerExchangeResponse => {
    return decodeMessage(buf, PeerExchangeResponse.codec());
  };
}

export interface PeerExchangeRPC {
  query: PeerExchangeQuery;
  response: PeerExchangeResponse;
}

export namespace PeerExchangeRPC {
  let _codec: Codec<PeerExchangeRPC>;

  export const codec = (): Codec<PeerExchangeRPC> => {
    if (_codec == null) {
      _codec = message<PeerExchangeRPC>(
        (obj, writer, opts = {}) => {
          if (opts.lengthDelimited !== false) {
            writer.fork();
          }

          if (obj.query != null) {
            writer.uint32(10);
            PeerExchangeQuery.codec().encode(obj.query, writer);
          } else {
            throw new Error(
              'Protocol error: required field "query" was not found in object'
            );
          }

          if (obj.response != null) {
            writer.uint32(18);
            PeerExchangeResponse.codec().encode(obj.response, writer);
          } else {
            throw new Error(
              'Protocol error: required field "response" was not found in object'
            );
          }

          if (opts.lengthDelimited !== false) {
            writer.ldelim();
          }
        },
        (reader, length) => {
          const obj: any = {
            query: undefined,
            response: undefined,
          };

          const end = length == null ? reader.len : reader.pos + length;

          while (reader.pos < end) {
            const tag = reader.uint32();

            switch (tag >>> 3) {
              case 1:
                obj.query = PeerExchangeQuery.codec().decode(
                  reader,
                  reader.uint32()
                );
                break;
              case 2:
                obj.response = PeerExchangeResponse.codec().decode(
                  reader,
                  reader.uint32()
                );
                break;
              default:
                reader.skipType(tag & 7);
                break;
            }
          }

          if (obj.query == null) {
            throw new Error(
              'Protocol error: value for required field "query" was not found in protobuf'
            );
          }

          if (obj.response == null) {
            throw new Error(
              'Protocol error: value for required field "response" was not found in protobuf'
            );
          }

          return obj;
        }
      );
    }

    return _codec;
  };

  export const encode = (obj: PeerExchangeRPC): Uint8Array => {
    return encodeMessage(obj, PeerExchangeRPC.codec());
  };

  export const decode = (buf: Uint8Array | Uint8ArrayList): PeerExchangeRPC => {
    return decodeMessage(buf, PeerExchangeRPC.codec());
  };
}

import { proto_metadata as proto } from "@waku/proto";
import type { Uint8ArrayList } from "uint8arraylist";
import { v4 as uuid } from "uuid";

export class MetadataRpc {
  public constructor(public proto: proto.MetadataRpc) {}

  static createRequest(
    clusterId: number | undefined,
    shards: number[]
  ): MetadataRpc {
    return new MetadataRpc({
      requestId: uuid(),
      request: {
        clusterId: clusterId,
        shards: shards
      },
      response: undefined
    });
  }

  static decode(bytes: Uint8ArrayList): MetadataRpc {
    const res = proto.MetadataRpc.decode(bytes);
    return new MetadataRpc(res);
  }

  encode(): Uint8Array {
    return proto.MetadataRpc.encode(this.proto);
  }

  get query(): proto.WakuMetadataRequest | undefined {
    return this.proto.request;
  }

  get response(): proto.WakuMetadataResponse | undefined {
    return this.proto.response;
  }
}

import { proto_lightpush as proto } from "@waku/proto";
import type { Uint8ArrayList } from "uint8arraylist";
import { v4 as uuid } from "uuid";

export class PushRpc {
  public constructor(public proto: proto.PushRpc) {}

  static createRequest(
    message: proto.WakuMessage,
    pubsubTopic: string
  ): PushRpc {
    return new PushRpc({
      requestId: uuid(),
      request: {
        message: message,
        pubsubTopic: pubsubTopic
      },
      response: undefined
    });
  }

  static decode(bytes: Uint8ArrayList): PushRpc {
    const res = proto.PushRpc.decode(bytes);
    return new PushRpc(res);
  }

  encode(): Uint8Array {
    return proto.PushRpc.encode(this.proto);
  }

  get query(): proto.PushRequest | undefined {
    return this.proto.request;
  }

  get response(): proto.PushResponse | undefined {
    return this.proto.response;
  }
}

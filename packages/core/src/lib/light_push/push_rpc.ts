import { proto_lightpush as proto } from "@waku/proto";
import type { Uint8ArrayList } from "uint8arraylist";
import { v4 as uuid } from "uuid";

export class PushRpc {
  public constructor(public proto: proto.PushRpc) {}

  public static createRequest(
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

  public static decode(bytes: Uint8ArrayList): PushRpc {
    const res = proto.PushRpc.decode(bytes);
    return new PushRpc(res);
  }

  public encode(): Uint8Array {
    return proto.PushRpc.encode(this.proto);
  }

  public get query(): proto.PushRequest | undefined {
    return this.proto.request;
  }

  public get response(): proto.PushResponse | undefined {
    return this.proto.response;
  }
}

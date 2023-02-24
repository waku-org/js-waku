import { proto_lightpush as proto } from "@waku/proto";
import type { Uint8ArrayList } from "uint8arraylist";
import { v4 as uuid } from "uuid";

export class PushRPC {
  public constructor(public proto: proto.PushRpc) {}

  static createRequest(
    message: proto.WakuMessage,
    pubSubTopic: string
  ): PushRPC {
    return new PushRPC({
      requestId: uuid(),
      request: {
        message: message,
        pubsubTopic: pubSubTopic,
      },
      response: undefined,
    });
  }

  static decode(bytes: Uint8ArrayList): PushRPC {
    const res = proto.PushRpc.decode(bytes);
    return new PushRPC(res);
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

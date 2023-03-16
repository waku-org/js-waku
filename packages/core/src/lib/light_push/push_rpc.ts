import { proto_lightpush as proto, proto_message } from "@waku/proto";
import type { Uint8ArrayList } from "uint8arraylist";
import { v4 as uuid } from "uuid";

export class PushRpc {
  public constructor(public proto: proto.PushRpc) {}

  static createRequest(
    message: proto_message.WakuMessage,
    pubSubTopic: string
  ): proto.PushRpc {
    const request = new proto.PushRequest({
      message,
      pubsubTopic: pubSubTopic,
    });
    return new proto.PushRpc({
      requestId: uuid(),
      request,
    });
  }

  static decode(bytes: Uint8ArrayList): PushRpc {
    const uint8array = bytes.slice();
    const res = proto.PushRpc.fromBinary(uint8array);
    return new PushRpc(res);
  }

  encode(): Uint8Array {
    return new proto.PushRpc(this.proto).toBinary();
  }

  get query(): proto.PushRequest | undefined {
    return this.proto.request;
  }

  get response(): proto.PushResponse | undefined {
    return this.proto.response;
  }
}

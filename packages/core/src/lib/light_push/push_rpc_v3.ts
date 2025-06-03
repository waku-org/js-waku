import { proto_lightpush_v3, WakuMessage } from "@waku/proto";
import type { Uint8ArrayList } from "uint8arraylist";
import { v4 as uuid } from "uuid";

export class PushRpcV3 {
  public request?: proto_lightpush_v3.LightpushRequest;
  public response?: proto_lightpush_v3.LightpushResponse;

  private constructor(
    request?: proto_lightpush_v3.LightpushRequest,
    response?: proto_lightpush_v3.LightpushResponse
  ) {
    this.request = request;
    this.response = response;
  }

  public static createRequest(
    message: WakuMessage,
    pubsubTopic?: string
  ): PushRpcV3 {
    const request: proto_lightpush_v3.LightpushRequest = {
      requestId: uuid(),
      message: message,
      ...(pubsubTopic && { pubsubTopic })
    };

    return new PushRpcV3(request, undefined);
  }

  public static decode(bytes: Uint8ArrayList | Uint8Array): PushRpcV3 {
    const response = proto_lightpush_v3.LightpushResponse.decode(bytes);
    return new PushRpcV3(undefined, response);
  }

  public encode(): Uint8Array {
    if (!this.request) {
      throw new Error("Cannot encode without a request");
    }
    return proto_lightpush_v3.LightpushRequest.encode(this.request);
  }

  public get query(): proto_lightpush_v3.LightpushRequest | undefined {
    return this.request;
  }
}

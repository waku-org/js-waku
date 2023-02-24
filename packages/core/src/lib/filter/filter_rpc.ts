import { proto_filter as proto } from "@waku/proto";
import { v4 as uuid } from "uuid";

export type ContentFilter = {
  contentTopic: string;
};

/**
 * FilterRPC represents a message conforming to the Waku Filter protocol
 */
export class FilterRpc {
  public constructor(public proto: proto.FilterRpc) {}

  static createRequest(
    topic: string,
    contentFilters: ContentFilter[],
    requestId?: string,
    subscribe = true
  ): FilterRpc {
    return new FilterRpc({
      requestId: requestId || uuid(),
      request: {
        subscribe,
        topic,
        contentFilters,
      },
      push: undefined,
    });
  }

  /**
   *
   * @param bytes Uint8Array of bytes from a FilterRPC message
   * @returns FilterRpc
   */
  static decode(bytes: Uint8Array): FilterRpc {
    const res = proto.FilterRpc.decode(bytes);
    return new FilterRpc(res);
  }

  /**
   * Encode the current FilterRPC request to bytes
   * @returns Uint8Array
   */
  encode(): Uint8Array {
    return proto.FilterRpc.encode(this.proto);
  }

  get push(): proto.MessagePush | undefined {
    return this.proto.push;
  }

  get requestId(): string {
    return this.proto.requestId;
  }
}

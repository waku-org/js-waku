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
  ): proto.FilterRpc {
    const request = new proto.FilterRequest({
      subscribe,
      topic,
      contentFilters: contentFilters.map(
        (f) => new proto.FilterRequest_ContentFilter(f)
      ),
    });
    return new proto.FilterRpc({
      requestId: requestId || uuid(),
      request,
    });
  }

  /**
   *
   * @param bytes Uint8Array of bytes from a FilterRPC message
   * @returns FilterRpc
   */
  static decode(bytes: Uint8Array): FilterRpc {
    const res = proto.FilterRpc.fromBinary(bytes);
    return new FilterRpc(res);
  }

  /**
   * Encode the current FilterRPC request to bytes
   * @returns Uint8Array
   */
  encode(): Uint8Array {
    return new proto.FilterRpc(this.proto).toBinary();
  }

  get push(): proto.MessagePush | undefined {
    return this.proto.push;
  }

  get requestId(): string {
    return this.proto.requestId;
  }
}

import { v4 as uuid } from "uuid";

import * as proto from "../../proto/filter.js";

export type ContentFilter = {
  contentTopic: string;
};

/**
 * FilterRPC represents a message conforming to the Waku Filter protocol
 */
export class FilterRPC {
  public constructor(public proto: proto.FilterRPC) {}

  static createRequest(
    topic: string,
    contentFilters: ContentFilter[],
    requestId?: string,
    subscribe = true
  ): FilterRPC {
    return new FilterRPC({
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
   * @returns FilterRPC
   */
  static decode(bytes: Uint8Array): FilterRPC {
    const res = proto.FilterRPC.decode(bytes);
    return new FilterRPC(res);
  }

  /**
   * Encode the current FilterRPC request to bytes
   * @returns Uint8Array
   */
  encode(): Uint8Array {
    return proto.FilterRPC.encode(this.proto);
  }

  get push(): proto.MessagePush | undefined {
    return this.proto.push;
  }

  get requestId(): string | undefined {
    return this.proto.requestId;
  }
}

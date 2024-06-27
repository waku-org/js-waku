import { QueryRequestParams } from "@waku/interfaces";
import { proto_store_v3 as proto } from "@waku/proto";
import type { Uint8ArrayList } from "uint8arraylist";
import { v4 as uuid } from "uuid";

const ONE_MILLION = 1_000000;

export class StoreQueryRequest {
  public constructor(public proto: proto.StoreQueryRequest) {}

  static create(params: QueryRequestParams): StoreQueryRequest {
    const request = new StoreQueryRequest({
      ...params,
      requestId: uuid(),
      timeStart: params.timeStart
        ? BigInt(params.timeStart.getTime() * ONE_MILLION)
        : undefined,
      timeEnd: params.timeEnd
        ? BigInt(params.timeEnd.getTime() * ONE_MILLION)
        : undefined,
      messageHashes: params.messageHashes || [],
      paginationLimit: params.paginationLimit
        ? BigInt(params.paginationLimit)
        : undefined
    });

    // Validate request parameters based on RFC
    if (
      (params.pubsubTopic && !params.contentTopics) ||
      (!params.pubsubTopic && params.contentTopics)
    ) {
      throw new Error(
        "Both pubsubTopic and contentTopics must be set or unset"
      );
    }

    if (
      params.messageHashes &&
      (params.pubsubTopic ||
        params.contentTopics ||
        params.timeStart ||
        params.timeEnd)
    ) {
      throw new Error(
        "Message hash lookup queries cannot include content filter criteria"
      );
    }

    return request;
  }

  static decode(bytes: Uint8ArrayList): StoreQueryRequest {
    const res = proto.StoreQueryRequest.decode(bytes);
    return new StoreQueryRequest(res);
  }

  encode(): Uint8Array {
    return proto.StoreQueryRequest.encode(this.proto);
  }
}

export class StoreQueryResponse {
  public constructor(public proto: proto.StoreQueryResponse) {}

  static decode(bytes: Uint8ArrayList): StoreQueryResponse {
    const res = proto.StoreQueryResponse.decode(bytes);
    return new StoreQueryResponse(res);
  }

  encode(): Uint8Array {
    return proto.StoreQueryResponse.encode(this.proto);
  }

  get statusCode(): number | undefined {
    return this.proto.statusCode;
  }

  get statusDesc(): string | undefined {
    return this.proto.statusDesc;
  }

  get messages(): proto.WakuMessageKeyValue[] {
    return this.proto.messages;
  }

  get paginationCursor(): Uint8Array | undefined {
    return this.proto.paginationCursor;
  }
}

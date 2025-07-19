import { QueryRequestParams } from "@waku/interfaces";
import { proto_store as proto } from "@waku/proto";
import type { Uint8ArrayList } from "uint8arraylist";
import { v4 as uuid } from "uuid";

// https://github.com/waku-org/nwaku/blob/7205f95cff9f49ca0bb762e8fd0bf56a6a7f3b3b/waku/waku_store/common.nim#L12
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export const MAX_TIME_RANGE = 24 * 60 * 60 * 1000;
const ONE_MILLION = 1_000000;

export class StoreQueryRequest {
  public constructor(public proto: proto.StoreQueryRequest) {}

  public static create(params: QueryRequestParams): StoreQueryRequest {
    const request = new StoreQueryRequest({
      ...params,
      contentTopics: params.contentTopics || [],
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

    const isHashQuery = params.messageHashes && params.messageHashes.length > 0;
    const hasContentTopics =
      params.contentTopics && params.contentTopics.length > 0;
    const hasTimeFilter = params.timeStart || params.timeEnd;

    if (isHashQuery) {
      if (hasContentTopics || hasTimeFilter) {
        throw new Error(
          "Message hash lookup queries cannot include content filter criteria (contentTopics, timeStart, or timeEnd)"
        );
      }
    } else {
      if (
        (params.routingInfo &&
          (!params.contentTopics || params.contentTopics.length === 0)) ||
        (!params.routingInfo &&
          params.contentTopics &&
          params.contentTopics.length > 0)
      ) {
        throw new Error(
          "Both pubsubTopic and contentTopics must be set together for content-filtered queries"
        );
      }
    }

    return request;
  }

  public static decode(bytes: Uint8ArrayList): StoreQueryRequest {
    const res = proto.StoreQueryRequest.decode(bytes);
    return new StoreQueryRequest(res);
  }

  public encode(): Uint8Array {
    return proto.StoreQueryRequest.encode(this.proto);
  }
}

export class StoreQueryResponse {
  public constructor(public proto: proto.StoreQueryResponse) {}

  public static decode(bytes: Uint8ArrayList): StoreQueryResponse {
    const res = proto.StoreQueryResponse.decode(bytes);
    return new StoreQueryResponse(res);
  }

  public encode(): Uint8Array {
    return proto.StoreQueryResponse.encode(this.proto);
  }

  public get statusCode(): number | undefined {
    return this.proto.statusCode;
  }

  public get statusDesc(): string | undefined {
    return this.proto.statusDesc;
  }

  public get messages(): proto.WakuMessageKeyValue[] {
    return this.proto.messages;
  }

  public get paginationCursor(): Uint8Array | undefined {
    return this.proto.paginationCursor;
  }
}

import Long from "long";
import { Reader } from "protobufjs/minimal";
import { v4 as uuid } from "uuid";

import * as protoV2Beta3 from "../../proto/waku/v2/store/v2beta3/store";
import * as protoV2Beta4 from "../../proto/waku/v2/store/v2beta4/store";

import { StoreCodecs } from "./constants";

export enum PageDirection {
  BACKWARD = "backward",
  FORWARD = "forward",
}

export interface Params {
  contentTopics: string[];
  pubSubTopic: string;
  pageDirection: PageDirection;
  pageSize: number;
  startTime?: Date;
  endTime?: Date;
  cursor?: protoV2Beta3.Index | protoV2Beta4.Index;
  storeCodec?: StoreCodecs;
}

export class HistoryRPC {
  private readonly protoCodec: any;

  private constructor(
    public readonly proto: protoV2Beta3.HistoryRPC | protoV2Beta4.HistoryRPC,
    public readonly storeCodec: StoreCodecs
  ) {
    switch (storeCodec) {
      case StoreCodecs.V2Beta3:
        this.protoCodec = protoV2Beta3;
        break;
      case StoreCodecs.V2Beta4:
        this.protoCodec = protoV2Beta4;
        break;
      default:
        throw `Internal Error: Unexpected store codec value received in constructor: ${storeCodec}`;
    }
  }

  get query():
    | protoV2Beta3.HistoryQuery
    | protoV2Beta4.HistoryQuery
    | undefined {
    return this.proto.query;
  }

  get response():
    | protoV2Beta3.HistoryResponse
    | protoV2Beta4.HistoryResponse
    | undefined {
    return this.proto.response;
  }

  /**
   * Create History Query.
   */
  static createQuery(params: Params): HistoryRPC {
    const storeCodec = params.storeCodec ?? StoreCodecs.V2Beta4;

    const contentFilters = params.contentTopics.map((contentTopic) => {
      return { contentTopic };
    });

    const direction = directionToProto(params.pageDirection);

    switch (storeCodec) {
      case StoreCodecs.V2Beta3:
        // Using function to scope variables
        return ((): HistoryRPC => {
          const pagingInfo = {
            pageSize: Long.fromNumber(params.pageSize),
            cursor: params.cursor,
            direction,
          } as protoV2Beta3.PagingInfo;

          let startTime, endTime;
          if (params.startTime) startTime = params.startTime.valueOf() / 1000;

          if (params.endTime) endTime = params.endTime.valueOf() / 1000;

          return new HistoryRPC(
            {
              requestId: uuid(),
              query: {
                pubSubTopic: params.pubSubTopic,
                contentFilters,
                pagingInfo,
                startTime,
                endTime,
              },
              response: undefined,
            },
            storeCodec
          );
        })();
      case StoreCodecs.V2Beta4:
        return ((): HistoryRPC => {
          const pagingInfo = {
            pageSize: Long.fromNumber(params.pageSize),
            cursor: params.cursor,
            direction,
          } as protoV2Beta4.PagingInfo;

          let startTime, endTime;
          if (params.startTime) {
            // milliseconds 10^-3 to nanoseconds 10^-9
            startTime = Long.fromNumber(params.startTime.valueOf()).mul(
              1_000_000
            );
          }

          if (params.endTime) {
            // milliseconds 10^-3 to nanoseconds 10^-9
            endTime = Long.fromNumber(params.endTime.valueOf()).mul(1_000_000);
          }
          return new HistoryRPC(
            {
              requestId: uuid(),
              query: {
                pubSubTopic: params.pubSubTopic,
                contentFilters,
                pagingInfo,
                startTime,
                endTime,
              },
              response: undefined,
            },
            storeCodec
          );
        })();

      default:
        throw `Internal Error: Unexpected store codec value received in createQuery: ${storeCodec}`;
    }
  }

  decode(bytes: Uint8Array): HistoryRPC {
    const res = this.protoCodec.HistoryRPC.decode(Reader.create(bytes));
    return new HistoryRPC(res, this.storeCodec);
  }

  encode(): Uint8Array {
    return this.protoCodec.HistoryRPC.encode(this.proto).finish();
  }
}

function directionToProto(
  pageDirection: PageDirection
): protoV2Beta4.PagingInfo_Direction {
  switch (pageDirection) {
    case PageDirection.BACKWARD:
      return protoV2Beta4.PagingInfo_Direction.DIRECTION_BACKWARD_UNSPECIFIED;
    case PageDirection.FORWARD:
      return protoV2Beta4.PagingInfo_Direction.DIRECTION_FORWARD;
    default:
      return protoV2Beta4.PagingInfo_Direction.DIRECTION_BACKWARD_UNSPECIFIED;
  }
}

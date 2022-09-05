import type { Uint8ArrayList } from "uint8arraylist";
import { v4 as uuid } from "uuid";

import * as protoV2Beta3 from "../../proto/store_v2beta3";
import * as protoV2Beta4 from "../../proto/store_v2beta4";

import { StoreCodecs } from "./constants";

const OneMillion = BigInt(1_000_000);

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
  private readonly historyRpc:
    | typeof protoV2Beta3.HistoryRPC
    | typeof protoV2Beta4.HistoryRPC;

  private constructor(
    public readonly proto: protoV2Beta3.HistoryRPC | protoV2Beta4.HistoryRPC,
    public readonly storeCodec: StoreCodecs
  ) {
    switch (storeCodec) {
      case StoreCodecs.V2Beta3:
        this.historyRpc = protoV2Beta3.HistoryRPC;
        break;
      case StoreCodecs.V2Beta4:
        this.historyRpc = protoV2Beta4.HistoryRPC;
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
            pageSize: BigInt(params.pageSize),
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
            pageSize: BigInt(params.pageSize),
            cursor: params.cursor,
            direction,
          } as protoV2Beta4.PagingInfo;

          let startTime, endTime;
          if (params.startTime) {
            // milliseconds 10^-3 to nanoseconds 10^-9
            startTime = BigInt(params.startTime.valueOf()) * OneMillion;
          }

          if (params.endTime) {
            // milliseconds 10^-3 to nanoseconds 10^-9
            endTime = BigInt(params.endTime.valueOf()) * OneMillion;
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

  decode(bytes: Uint8ArrayList): HistoryRPC {
    const res = this.historyRpc.decode(bytes);
    return new HistoryRPC(res, this.storeCodec);
  }

  encode(): Uint8Array {
    return this.historyRpc.encode(this.proto as any);
  }
}

function directionToProto(
  pageDirection: PageDirection
): protoV2Beta4.PagingInfo.Direction {
  switch (pageDirection) {
    case PageDirection.BACKWARD:
      return protoV2Beta4.PagingInfo.Direction.DIRECTION_BACKWARD_UNSPECIFIED;
    case PageDirection.FORWARD:
      return protoV2Beta4.PagingInfo.Direction.DIRECTION_FORWARD;
    default:
      return protoV2Beta4.PagingInfo.Direction.DIRECTION_BACKWARD_UNSPECIFIED;
  }
}

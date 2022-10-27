import type { Uint8ArrayList } from "uint8arraylist";
import { v4 as uuid } from "uuid";

import * as protoV2Beta4 from "../../proto/store_v2beta4";

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
  cursor?: protoV2Beta4.Index;
}

export class HistoryRPC {
  private constructor(public readonly proto: protoV2Beta4.HistoryRPC) {}

  get query(): protoV2Beta4.HistoryQuery | undefined {
    return this.proto.query;
  }

  get response(): protoV2Beta4.HistoryResponse | undefined {
    return this.proto.response;
  }

  /**
   * Create History Query.
   */
  static createQuery(params: Params): HistoryRPC {
    const contentFilters = params.contentTopics.map((contentTopic) => {
      return { contentTopic };
    });

    const direction = directionToProto(params.pageDirection);

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
    return new HistoryRPC({
      requestId: uuid(),
      query: {
        pubSubTopic: params.pubSubTopic,
        contentFilters,
        pagingInfo,
        startTime,
        endTime,
      },
      response: undefined,
    });
  }

  decode(bytes: Uint8ArrayList): HistoryRPC {
    const res = protoV2Beta4.HistoryRPC.decode(bytes);
    return new HistoryRPC(res);
  }

  encode(): Uint8Array {
    return protoV2Beta4.HistoryRPC.encode(this.proto);
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

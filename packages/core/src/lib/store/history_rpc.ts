import { protoStore as proto } from "@waku/proto";
import type { Uint8ArrayList } from "uint8arraylist";
import { v4 as uuid } from "uuid";

const OneMillion = BigInt(1_000_000);

export enum PageDirection {
  BACKWARD = "backward",
  FORWARD = "forward"
}

export interface Params {
  contentTopics: string[];
  pubsubTopic: string;
  pageDirection: PageDirection;
  pageSize: number;
  startTime?: Date;
  endTime?: Date;
  cursor?: proto.Index;
}

export class HistoryRpc {
  private constructor(public readonly proto: proto.HistoryRpc) {}

  get query(): proto.HistoryQuery | undefined {
    return this.proto.query;
  }

  get response(): proto.HistoryResponse | undefined {
    return this.proto.response;
  }

  /**
   * Create History Query.
   */
  static createQuery(params: Params): HistoryRpc {
    const contentFilters = params.contentTopics.map((contentTopic) => {
      return { contentTopic };
    });

    const direction = directionToProto(params.pageDirection);

    const pagingInfo = {
      pageSize: BigInt(params.pageSize),
      cursor: params.cursor,
      direction
    } as proto.PagingInfo;

    let startTime, endTime;
    if (params.startTime) {
      // milliseconds 10^-3 to nanoseconds 10^-9
      startTime = BigInt(params.startTime.valueOf()) * OneMillion;
    }

    if (params.endTime) {
      // milliseconds 10^-3 to nanoseconds 10^-9
      endTime = BigInt(params.endTime.valueOf()) * OneMillion;
    }
    return new HistoryRpc({
      requestId: uuid(),
      query: {
        pubsubTopic: params.pubsubTopic,
        contentFilters,
        pagingInfo,
        startTime,
        endTime
      },
      response: undefined
    });
  }

  decode(bytes: Uint8ArrayList): HistoryRpc {
    const res = proto.HistoryRpc.decode(bytes);
    return new HistoryRpc(res);
  }

  encode(): Uint8Array {
    return proto.HistoryRpc.encode(this.proto);
  }
}

function directionToProto(
  pageDirection: PageDirection
): proto.PagingInfo.Direction {
  switch (pageDirection) {
    case PageDirection.BACKWARD:
      return proto.PagingInfo.Direction.BACKWARD;
    case PageDirection.FORWARD:
      return proto.PagingInfo.Direction.FORWARD;
    default:
      return proto.PagingInfo.Direction.BACKWARD;
  }
}

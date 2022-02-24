import { Reader } from "protobufjs/minimal";
import { v4 as uuid } from "uuid";

import * as proto from "../../proto/waku/v2/store/v2beta3/store";

export enum PageDirection {
  BACKWARD = "backward",
  FORWARD = "forward",
}

export interface Params {
  contentTopics: string[];
  pubSubTopic: string;
  pageDirection: PageDirection;
  pageSize: number;
  startTime?: number;
  endTime?: number;
  cursor?: proto.Index;
}

export class HistoryRPC {
  public constructor(public proto: proto.HistoryRPC) {}

  /**
   * Create History Query.
   */
  static createQuery(params: Params): HistoryRPC {
    const direction = directionToProto(params.pageDirection);
    const pagingInfo = {
      pageSize: params.pageSize,
      cursor: params.cursor,
      direction,
    };

    const contentFilters = params.contentTopics.map((contentTopic) => {
      return { contentTopic };
    });

    return new HistoryRPC({
      requestId: uuid(),
      query: {
        pubSubTopic: params.pubSubTopic,
        contentFilters,
        pagingInfo,
        startTime: params.startTime,
        endTime: params.endTime,
      },
      response: undefined,
    });
  }

  static decode(bytes: Uint8Array): HistoryRPC {
    const res = proto.HistoryRPC.decode(Reader.create(bytes));
    return new HistoryRPC(res);
  }

  encode(): Uint8Array {
    return proto.HistoryRPC.encode(this.proto).finish();
  }

  get query(): proto.HistoryQuery | undefined {
    return this.proto.query;
  }

  get response(): proto.HistoryResponse | undefined {
    return this.proto.response;
  }
}

function directionToProto(
  pageDirection: PageDirection
): proto.PagingInfo_Direction {
  switch (pageDirection) {
    case PageDirection.BACKWARD:
      return proto.PagingInfo_Direction.DIRECTION_BACKWARD_UNSPECIFIED;
    case PageDirection.FORWARD:
      return proto.PagingInfo_Direction.DIRECTION_FORWARD;
    default:
      return proto.PagingInfo_Direction.DIRECTION_BACKWARD_UNSPECIFIED;
  }
}

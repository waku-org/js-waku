import { proto_store as proto } from "@waku/proto";
import { v4 as uuid } from "uuid";

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
  cursor?: proto.Index;
}

export function createQuery(params: Params): proto.HistoryRpc {
  const contentFilters = params.contentTopics.map((contentTopic) => {
    return { contentTopic };
  });

  const direction = directionToProto(params.pageDirection);

  const pagingInfo = {
    pageSize: BigInt(params.pageSize),
    cursor: params.cursor,
    direction,
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

  const query = new proto.HistoryQuery({
    pubsubTopic: params.pubSubTopic,
    contentFilters,
    pagingInfo,
    startTime,
    endTime,
  });

  return new proto.HistoryRpc({
    requestId: uuid(),
    query,
  });
}

function directionToProto(
  pageDirection: PageDirection
): proto.PagingInfo_Direction {
  switch (pageDirection) {
    case PageDirection.BACKWARD:
      return proto.PagingInfo_Direction.BACKWARD;
    case PageDirection.FORWARD:
      return proto.PagingInfo_Direction.FORWARD;
    default:
      return proto.PagingInfo_Direction.BACKWARD;
  }
}

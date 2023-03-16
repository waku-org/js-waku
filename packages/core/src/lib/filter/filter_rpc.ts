import { proto_filter as proto } from "@waku/proto";
import { v4 as uuid } from "uuid";

export type ContentFilter = {
  contentTopic: string;
};

export function createRequest(
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

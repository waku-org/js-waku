import { Reader } from 'protobufjs/minimal';
import { v4 as uuid } from 'uuid';

import * as proto from '../../proto/waku/v2/store';

export enum Direction {
  BACKWARD = 'backward',
  FORWARD = 'forward',
}

export interface Options {
  contentTopics: string[];
  cursor?: proto.Index;
  pubsubTopic: string;
  direction: Direction;
  pageSize: number;
}

export class HistoryRPC {
  public constructor(public proto: proto.HistoryRPC) {}

  /**
   * Create History Query.
   */
  static createQuery(options: Options): HistoryRPC {
    const direction = directionToProto(options.direction);
    const pagingInfo = {
      pageSize: options.pageSize,
      cursor: options.cursor,
      direction,
    };

    const contentFilters = options.contentTopics.map((contentTopic) => {
      return { contentTopic };
    });

    return new HistoryRPC({
      requestId: uuid(),
      query: {
        pubsubTopic: options.pubsubTopic,
        contentFilters,
        pagingInfo,
        startTime: undefined,
        endTime: undefined,
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

function directionToProto(direction: Direction): proto.PagingInfo_Direction {
  switch (direction) {
    case Direction.BACKWARD:
      return proto.PagingInfo_Direction.DIRECTION_BACKWARD_UNSPECIFIED;
    case Direction.FORWARD:
      return proto.PagingInfo_Direction.DIRECTION_FORWARD;
    default:
      return proto.PagingInfo_Direction.DIRECTION_BACKWARD_UNSPECIFIED;
  }
}

import { Reader } from 'protobufjs/minimal';
import { v4 as uuid } from 'uuid';

import * as proto from '../../proto/waku/v2/store';
import { DefaultContentTopic } from '../waku_message';
import { RelayDefaultTopic } from '../waku_relay';

export class HistoryRPC {
  public constructor(public proto: proto.HistoryRPC) {}

  static createQuery(
    contentTopics: string[] = [DefaultContentTopic],
    cursor?: proto.Index,
    pubsubTopic: string = RelayDefaultTopic
  ): HistoryRPC {
    const pagingInfo = {
      pageSize: 10,
      cursor,
      direction: proto.PagingInfo_Direction.DIRECTION_FORWARD,
    };

    const contentFilters = contentTopics.map((contentTopic) => {
      return { contentTopic };
    });

    return new HistoryRPC({
      requestId: uuid(),
      query: {
        pubsubTopic,
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

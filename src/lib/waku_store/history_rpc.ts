import { Reader } from 'protobufjs/minimal';
import { v4 as uuid } from 'uuid';

import * as proto from '../../proto/waku/v2/store';
import { DEFAULT_CONTENT_TOPIC } from '../waku_message';

export class HistoryRPC {
  public constructor(public proto: proto.HistoryRPC) {}

  static query(topics: string[] = [DEFAULT_CONTENT_TOPIC]): HistoryRPC {
    const pagingInfo = {
      pageSize: 10,
      cursor: undefined,
      direction: proto.Direction.DIRECTION_BACKWARD_UNSPECIFIED,
    };
    return new HistoryRPC({
      requestId: uuid(),
      query: { topics, pagingInfo, startTime: undefined, endTime: undefined },
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

  get response(): proto.HistoryResponse | undefined {
    return this.proto.response;
  }
}

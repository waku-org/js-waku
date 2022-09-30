import { WakuMessage as WakuMessageProto } from "../proto/message";

import { ProtoMessage } from "./interfaces";

const EmptyMessage: ProtoMessage = {
  payload: undefined,
  contentTopic: undefined,
  version: undefined,
  timestamp: undefined,
  rateLimitProof: undefined,
};

export function toProtoMessage(wire: WakuMessageProto): ProtoMessage {
  return { ...EmptyMessage, ...wire };
}

import { ProtoMessage } from "@waku/interfaces";
import { WakuMessage as WakuMessageProto } from "@waku/proto";

const EmptyMessage: ProtoMessage = {
  payload: undefined,
  contentTopic: undefined,
  version: undefined,
  timestamp: undefined,
  rateLimitProof: undefined,
  ephemeral: undefined,
};

export function toProtoMessage(wire: WakuMessageProto): ProtoMessage {
  return { ...EmptyMessage, ...wire };
}

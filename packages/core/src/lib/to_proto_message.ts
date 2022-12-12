import { IProtoMessage } from "@waku/interfaces";
import { WakuMessage as WakuMessageProto } from "@waku/proto";

const EmptyMessage: IProtoMessage = {
  payload: undefined,
  contentTopic: undefined,
  version: undefined,
  timestamp: undefined,
  rateLimitProof: undefined,
  ephemeral: undefined,
};

export function toProtoMessage(wire: WakuMessageProto): IProtoMessage {
  return { ...EmptyMessage, ...wire };
}

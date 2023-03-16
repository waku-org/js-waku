import { proto_message } from "@waku/proto";

const EmptyMessage: proto_message.WakuMessage = new proto_message.WakuMessage();

export function toProtoMessage(
  wire: proto_message.WakuMessage
): proto_message.WakuMessage {
  return new proto_message.WakuMessage({ ...EmptyMessage, ...wire });
}

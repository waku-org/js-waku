import { WakuMessage } from "@waku/proto";

const EmptyMessage: WakuMessage = new WakuMessage();

export function toProtoMessage(wire: WakuMessage): WakuMessage {
  return new WakuMessage({ ...EmptyMessage, ...wire });
}

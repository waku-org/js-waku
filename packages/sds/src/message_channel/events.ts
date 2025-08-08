import { proto_sds_message } from "@waku/proto";

export enum MessageChannelEvent {
  MessageSent = "messageSent",
  MessageDelivered = "messageDelivered",
  MessageReceived = "messageReceived",
  MessageAcknowledged = "messageAcknowledged",
  PartialAcknowledgement = "partialAcknowledgement",
  MissedMessages = "missedMessages",
  SyncSent = "syncSent",
  SyncReceived = "syncReceived"
}

export type MessageId = string;
export type Message = proto_sds_message.SdsMessage;
export type HistoryEntry = proto_sds_message.HistoryEntry;
export type ChannelId = string;

export function encodeMessage(message: Message): Uint8Array {
  return proto_sds_message.SdsMessage.encode(message);
}

export function decodeMessage(data: Uint8Array): Message {
  return proto_sds_message.SdsMessage.decode(data);
}

export type MessageChannelEvents = {
  [MessageChannelEvent.MessageSent]: CustomEvent<Message>;
  [MessageChannelEvent.MessageDelivered]: CustomEvent<{
    messageId: MessageId;
    sentOrReceived: "sent" | "received";
  }>;
  [MessageChannelEvent.MessageReceived]: CustomEvent<Message>;
  [MessageChannelEvent.MessageAcknowledged]: CustomEvent<MessageId>;
  [MessageChannelEvent.PartialAcknowledgement]: CustomEvent<{
    messageId: MessageId;
    count: number;
  }>;
  [MessageChannelEvent.MissedMessages]: CustomEvent<HistoryEntry[]>;
  [MessageChannelEvent.SyncSent]: CustomEvent<Message>;
  [MessageChannelEvent.SyncReceived]: CustomEvent<Message>;
};

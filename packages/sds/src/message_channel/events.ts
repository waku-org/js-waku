import { HistoryEntry, Message, MessageId } from "./message.js";

export enum MessageChannelEvent {
  OutMessageSent = "sds:out:message-sent",
  InMessageDelivered = "sds:in:message-delivered",
  InMessageReceived = "sds:in:message-received",
  OutMessageAcknowledged = "sds:out:message-acknowledged",
  OutMessagePossiblyAcknowledged = "sds:out:message-possibly-acknowledged",
  InMessageMissing = "sds:in:message-missing",
  OutSyncSent = "sds:out:sync-sent",
  InSyncReceived = "sds:in:sync-received",
  InMessageLost = "sds:in:message-irretrievably-lost",
  ErrorTask = "sds:error-task",
  // SDS-R Repair Events
  RepairRequestQueued = "sds:repair:request-queued",
  RepairRequestSent = "sds:repair:request-sent",
  RepairRequestReceived = "sds:repair:request-received",
  RepairResponseQueued = "sds:repair:response-queued",
  RepairResponseSent = "sds:repair:response-sent"
}

export type MessageChannelEvents = {
  [MessageChannelEvent.OutMessageSent]: CustomEvent<Message>;
  [MessageChannelEvent.InMessageDelivered]: CustomEvent<MessageId>;
  [MessageChannelEvent.InMessageReceived]: CustomEvent<Message>;
  [MessageChannelEvent.OutMessageAcknowledged]: CustomEvent<MessageId>;
  [MessageChannelEvent.OutMessagePossiblyAcknowledged]: CustomEvent<{
    messageId: MessageId;
    count: number;
  }>;
  [MessageChannelEvent.InMessageMissing]: CustomEvent<HistoryEntry[]>;
  [MessageChannelEvent.InMessageLost]: CustomEvent<HistoryEntry[]>;
  [MessageChannelEvent.OutSyncSent]: CustomEvent<Message>;
  [MessageChannelEvent.InSyncReceived]: CustomEvent<Message>;
  [MessageChannelEvent.ErrorTask]: CustomEvent<unknown>;
  [MessageChannelEvent.RepairRequestQueued]: CustomEvent<{
    messageId: MessageId;
    tReq: number;
  }>;
  [MessageChannelEvent.RepairRequestSent]: CustomEvent<{
    messageIds: MessageId[];
    carrierMessageId: MessageId;
  }>;
  [MessageChannelEvent.RepairRequestReceived]: CustomEvent<{
    messageIds: MessageId[];
    fromSenderId?: ParticipantId;
  }>;
  [MessageChannelEvent.RepairResponseQueued]: CustomEvent<{
    messageId: MessageId;
    tResp: number;
  }>;
  [MessageChannelEvent.RepairResponseSent]: CustomEvent<{
    messageId: MessageId;
  }>;
};

import { proto_sds_message } from "@waku/proto";

export enum MessageChannelEvent {
  OutMessageSent = "sds:out:message-sent",
  InMessageDelivered = "sds:in:message-delivered",
  InMessageReceived = "sds:in:message-received",
  OutMessageAcknowledged = "sds:out:message-acknowledged",
  OutMessagePossiblyAcknowledged = "sds:out:message-possibly-acknowledged",
  InMessageMissing = "sds:in:message-missing",
  OutSyncSent = "sds:out:sync-sent",
  InSyncReceived = "sds:in:sync-received",
  InMessageIrretrievablyLost = "sds:in:message-irretrievably-lost",
  ErrorTask = "sds:error-task"
}

export type MessageId = string;
export type HistoryEntry = proto_sds_message.HistoryEntry;
export type ChannelId = string;
export type SenderId = string;

export class Message implements proto_sds_message.SdsMessage {
  public constructor(
    public messageId: string,
    public channelId: string,
    public senderId: string,
    public causalHistory: proto_sds_message.HistoryEntry[],
    public lamportTimestamp?: number | undefined,
    public bloomFilter?: Uint8Array<ArrayBufferLike> | undefined,
    public content?: Uint8Array<ArrayBufferLike> | undefined
  ) {}

  public encode(): Uint8Array {
    return proto_sds_message.SdsMessage.encode(this);
  }

  public static decode(data: Uint8Array): Message {
    const {
      messageId,
      channelId,
      senderId,
      causalHistory,
      lamportTimestamp,
      bloomFilter,
      content
    } = proto_sds_message.SdsMessage.decode(data);
    return new Message(
      messageId,
      channelId,
      senderId,
      causalHistory,
      lamportTimestamp,
      bloomFilter,
      content
    );
  }
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
  [MessageChannelEvent.InMessageIrretrievablyLost]: CustomEvent<HistoryEntry[]>;
  [MessageChannelEvent.OutSyncSent]: CustomEvent<Message>;
  [MessageChannelEvent.InSyncReceived]: CustomEvent<Message>;
  [MessageChannelEvent.ErrorTask]: CustomEvent<any>;
};

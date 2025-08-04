import { proto_sds_message } from "@waku/proto";

export enum MessageChannelEvent {
  OutMessageSent = "sds:out:message-sent",
  InMessageDelivered = "sds:in:message-delivered",
  InMessageReceived = "sds:in:message-received",
  OutMessageAcknowledged = "sds:out:message-acknowledged",
  OutMessagePossiblyAcknowledged = "sds:out:message-possibly-acknowledged",
  InMessageMissing = "sds:in:message-missing",
  OutSyncSent = "sds:out:sync-sent",
  InSyncDelivered = "sds:in:sync-delivered"
}

export type MessageId = string;
export type HistoryEntry = proto_sds_message.HistoryEntry;
export type ChannelId = string;

export class Message implements proto_sds_message.SdsMessage {
  public constructor(
    public messageId: string,
    public channelId: string,
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
      causalHistory,
      lamportTimestamp,
      bloomFilter,
      content
    } = proto_sds_message.SdsMessage.decode(data);
    return new Message(
      messageId,
      channelId,
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
  [MessageChannelEvent.OutSyncSent]: CustomEvent<Message>;
  [MessageChannelEvent.InSyncDelivered]: CustomEvent<Message>;
};

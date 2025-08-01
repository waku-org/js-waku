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

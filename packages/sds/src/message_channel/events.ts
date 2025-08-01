import { proto_sds_message } from "@waku/proto";

export enum MessageChannelEvent {
  // TODO: events are usually in the form `domain:name`
  // here it should be `sds:<name>`
  // also, it can be confusing to know if we are talking about incoming
  // or outgoing. suggesting `sds:in` or `sds:out` format.
  MessageSent = "messageSent",
  // TODO: Is this "delivered" event of any use?
  MessageDelivered = "messageDelivered",
  MessageReceived = "messageReceived",
  MessageAcknowledged = "messageAcknowledged",
  MessagePossiblyAcknowledged = "messagePossiblyAcknowledged",
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
    // TODO: this is never set to "sent"
    sentOrReceived: "sent" | "received";
  }>;
  [MessageChannelEvent.MessageReceived]: CustomEvent<Message>;
  [MessageChannelEvent.MessageAcknowledged]: CustomEvent<MessageId>;
  [MessageChannelEvent.MessagePossiblyAcknowledged]: CustomEvent<{
    messageId: MessageId;
    count: number;
  }>;
  [MessageChannelEvent.MissedMessages]: CustomEvent<HistoryEntry[]>;
  [MessageChannelEvent.SyncSent]: CustomEvent<Message>;
  [MessageChannelEvent.SyncReceived]: CustomEvent<Message>;
};

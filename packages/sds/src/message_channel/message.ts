import { proto_sds_message } from "@waku/proto";

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
    public content?: Uint8Array<ArrayBufferLike> | undefined,
    /**
     * Not encoded, set after it is sent, used to include in follow-up messages
     */
    public retrievalHint?: Uint8Array | undefined
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

export class SyncMessage extends Message {
  public constructor(
    public messageId: string,
    public channelId: string,
    public senderId: string,
    public causalHistory: proto_sds_message.HistoryEntry[],
    public lamportTimestamp: number,
    public bloomFilter: Uint8Array<ArrayBufferLike> | undefined,
    public content: undefined,
    /**
     * Not encoded, set after it is sent, used to include in follow-up messages
     */
    public retrievalHint?: Uint8Array | undefined
  ) {
    super(
      messageId,
      channelId,
      senderId,
      causalHistory,
      lamportTimestamp,
      bloomFilter,
      content,
      retrievalHint
    );
  }
}

export function isSyncMessage(
  message: Message | ContentMessage | SyncMessage | EphemeralMessage
): message is SyncMessage {
  return Boolean(
    "lamportTimestamp" in message &&
      typeof message.lamportTimestamp === "number" &&
      (message.content === undefined || message.content.length === 0)
  );
}

export class EphemeralMessage extends Message {
  public constructor(
    public messageId: string,
    public channelId: string,
    public senderId: string,
    public causalHistory: proto_sds_message.HistoryEntry[],
    public lamportTimestamp: undefined,
    public bloomFilter: Uint8Array<ArrayBufferLike> | undefined,
    public content: Uint8Array<ArrayBufferLike>,
    /**
     * Not encoded, set after it is sent, used to include in follow-up messages
     */
    public retrievalHint?: Uint8Array | undefined
  ) {
    if (!content || !content.length) {
      throw Error("Ephemeral Message must have content");
    }
    super(
      messageId,
      channelId,
      senderId,
      causalHistory,
      lamportTimestamp,
      bloomFilter,
      content,
      retrievalHint
    );
  }
}

export function isEphemeralMessage(
  message: Message | ContentMessage | SyncMessage | EphemeralMessage
): message is EphemeralMessage {
  return Boolean(
    message.lamportTimestamp === undefined &&
      "content" in message &&
      message.content &&
      message.content.length
  );
}

export class ContentMessage extends Message {
  public constructor(
    public messageId: string,
    public channelId: string,
    public senderId: string,
    public causalHistory: proto_sds_message.HistoryEntry[],
    public lamportTimestamp: number,
    public bloomFilter: Uint8Array<ArrayBufferLike> | undefined,
    public content: Uint8Array<ArrayBufferLike>,
    /**
     * Not encoded, set after it is sent, used to include in follow-up messages
     */
    public retrievalHint?: Uint8Array | undefined
  ) {
    if (!content.length) {
      throw Error("Content Message must have content");
    }
    super(
      messageId,
      channelId,
      senderId,
      causalHistory,
      lamportTimestamp,
      bloomFilter,
      content,
      retrievalHint
    );
  }

  // `valueOf` is used by comparison operands such as `<`
  public valueOf(): string {
    // Create a sortable string representation that matches the compare logic
    // Pad lamportTimestamp to ensure proper lexicographic ordering
    // Use 16 digits to handle up to Number.MAX_SAFE_INTEGER (9007199254740991)
    const paddedTimestamp = this.lamportTimestamp.toString().padStart(16, "0");
    return `${paddedTimestamp}_${this.messageId}`;
  }
}

export function isContentMessage(
  message: Message | ContentMessage
): message is ContentMessage {
  return Boolean(
    "lamportTimestamp" in message &&
      typeof message.lamportTimestamp === "number" &&
      message.content &&
      message.content.length
  );
}

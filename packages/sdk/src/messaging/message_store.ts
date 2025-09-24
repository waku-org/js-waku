import { messageHashStr } from "@waku/core";
import { IDecodedMessage, IEncoder, IMessage } from "@waku/interfaces";

type QueuedMessage = {
  encoder?: IEncoder;
  message?: IMessage;
  filterAck: boolean;
  storeAck: boolean;
  lastSentAt?: number;
  createdAt: number;
};

type MessageStoreOptions = {
  resendIntervalMs?: number;
};

export class MessageStore {
  private readonly messages: Map<string, QueuedMessage> = new Map();
  private readonly resendIntervalMs: number;

  public constructor(options: MessageStoreOptions = {}) {
    this.resendIntervalMs = options.resendIntervalMs ?? 2000;
  }

  public has(hashStr: string): boolean {
    return this.messages.has(hashStr);
  }

  public add(message: IDecodedMessage): void {
    if (!this.messages.has(message.hashStr)) {
      this.messages.set(message.hashStr, {
        filterAck: false,
        storeAck: false,
        createdAt: Date.now()
      });
    }
  }

  public markFilterAck(hashStr: string): void {
    const entry = this.messages.get(hashStr);
    if (!entry) return;
    entry.filterAck = true;
  }

  public markStoreAck(hashStr: string): void {
    const entry = this.messages.get(hashStr);
    if (!entry) return;
    entry.storeAck = true;
  }

  public markSent(hashStr: string): void {
    const entry = this.messages.get(hashStr);
    if (!entry) return;
    entry.lastSentAt = Date.now();
  }

  public async queue(
    encoder: IEncoder,
    message: IMessage
  ): Promise<string | undefined> {
    const proto = await encoder.toProtoObj(message);
    if (!proto) return undefined;
    const hashStr = messageHashStr(encoder.pubsubTopic, proto);
    const existing = this.messages.get(hashStr);
    if (!existing) {
      this.messages.set(hashStr, {
        encoder,
        message,
        filterAck: false,
        storeAck: false,
        createdAt: Date.now()
      });
    }
    return hashStr;
  }

  public getMessagesToSend(): Array<{
    hashStr: string;
    encoder: IEncoder;
    message: IMessage;
  }> {
    const now = Date.now();
    const res: Array<{
      hashStr: string;
      encoder: IEncoder;
      message: IMessage;
    }> = [];
    for (const [hashStr, entry] of this.messages.entries()) {
      if (!entry.encoder || !entry.message) continue;
      const isAcknowledged = entry.filterAck || entry.storeAck;
      if (isAcknowledged) continue;
      if (
        !entry.lastSentAt ||
        now - entry.lastSentAt >= this.resendIntervalMs
      ) {
        res.push({ hashStr, encoder: entry.encoder, message: entry.message });
      }
    }
    return res;
  }
}

import { message, messageHashStr } from "@waku/core";
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

type RequestId = string;

export class MessageStore {
  private readonly messages: Map<string, QueuedMessage> = new Map();
  private readonly pendingRequests: Map<RequestId, QueuedMessage> = new Map();

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
    // TODO: implement events
  }

  public markStoreAck(hashStr: string): void {
    const entry = this.messages.get(hashStr);
    if (!entry) return;
    entry.storeAck = true;
    // TODO: implement events
  }

  public async markSent(requestId: RequestId): Promise<void> {
    const entry = this.pendingRequests.get(requestId);

    if (!entry || !entry.encoder || !entry.message) {
      return;
    }

    try {
      entry.lastSentAt = Date.now();
      this.pendingRequests.delete(requestId);

      const proto = await entry.encoder.toProtoObj(entry.message);

      if (!proto) {
        return;
      }

      const hashStr = messageHashStr(entry.encoder.pubsubTopic, proto);

      this.messages.set(hashStr, entry);
    } catch (error) {
      // TODO: better recovery
      this.pendingRequests.set(requestId, entry);
    }
  }

  public async queue(
    encoder: IEncoder,
    message: IMessage
  ): Promise<RequestId | undefined> {
    const requestId = crypto.randomUUID();

    this.pendingRequests.set(requestId, {
      encoder,
      message,
      filterAck: false,
      storeAck: false,
      createdAt: Date.now()
    });

    return requestId;
  }

  public getMessagesToSend(): Array<{
    requestId: string;
    encoder: IEncoder;
    message: IMessage;
  }> {
    const now = Date.now();

    const res: Array<{
      requestId: string;
      encoder: IEncoder;
      message: IMessage;
    }> = [];

    for (const [requestId, entry] of this.pendingRequests.entries()) {
      if (!entry.encoder || !entry.message) {
        continue;
      }

      const isAcknowledged = entry.filterAck || entry.storeAck; // TODO: make sure it works with message and pending requests and returns messages to re-sent that are not ack yet

      if (isAcknowledged) {
        continue;
      }

      if (
        !entry.lastSentAt ||
        now - entry.lastSentAt >= this.resendIntervalMs
      ) {
        res.push({ requestId, encoder: entry.encoder, message: entry.message });
      }
    }

    return res;
  }
}

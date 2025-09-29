import { messageHashStr } from "@waku/core";
import { ICodec, IDecodedMessage, IMessage } from "@waku/interfaces";

type QueuedMessage = {
  codec?: ICodec<IDecodedMessage>;
  message?: IMessage;
  filterAck: boolean;
  storeAck: boolean;
  lastSentAt?: number;
  createdAt: number;
};

type AddMessageOptions = {
  filterAck?: boolean;
  storeAck?: boolean;
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

  public add(message: IDecodedMessage, options: AddMessageOptions = {}): void {
    if (!this.messages.has(message.hashStr)) {
      this.messages.set(message.hashStr, {
        filterAck: options.filterAck ?? false,
        storeAck: options.storeAck ?? false,
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

    if (!entry || !entry.codec || !entry.message) {
      return;
    }

    try {
      entry.lastSentAt = Date.now();
      this.pendingRequests.delete(requestId);

      const proto = await entry.codec.toProtoObj(entry.message);

      if (!proto) {
        return;
      }

      const hashStr = messageHashStr(entry.codec.pubsubTopic, proto);

      this.messages.set(hashStr, entry);
    } catch (error) {
      // TODO: better recovery
      this.pendingRequests.set(requestId, entry);
    }
  }

  public async queue(
    codec: ICodec<IDecodedMessage>,
    message: IMessage
  ): Promise<RequestId> {
    const requestId = crypto.randomUUID();

    this.pendingRequests.set(requestId, {
      codec,
      message,
      filterAck: false,
      storeAck: false,
      createdAt: Date.now()
    });

    return requestId;
  }

  public getMessagesToSend(): Array<{
    requestId: string;
    codec: ICodec<IDecodedMessage>;
    message: IMessage;
  }> {
    const now = Date.now();

    const res: Array<{
      requestId: string;
      codec: ICodec<IDecodedMessage>;
      message: IMessage;
    }> = [];

    for (const [requestId, entry] of this.pendingRequests.entries()) {
      const isAcknowledged = entry.filterAck || entry.storeAck;

      if (!entry.codec || !entry.message || isAcknowledged) {
        continue;
      }

      if (
        !entry.lastSentAt ||
        now - entry.lastSentAt >= this.resendIntervalMs
      ) {
        res.push({ requestId, codec: entry.codec, message: entry.message });
      }
    }

    return res;
  }
}

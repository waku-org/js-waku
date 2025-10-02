import { ICodec, IDecodedMessage, IMessage } from "@waku/interfaces";
import { v4 as uuidv4 } from "uuid";

type QueuedMessage = {
  codec?: ICodec<IDecodedMessage>;
  messageRequest?: IMessage;
  sentMessage?: IMessage;
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
type MessageHashStr = string;

export class MessageStore {
  private readonly messages: Map<MessageHashStr, QueuedMessage> = new Map();

  private readonly pendingRequests: Map<RequestId, QueuedMessage> = new Map();
  private readonly pendingMessages: Map<MessageHashStr, RequestId> = new Map();

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
    this.ackMessage(hashStr, { filterAck: true });
    this.replacePendingWithMessage(hashStr);
  }

  public markStoreAck(hashStr: string): void {
    this.ackMessage(hashStr, { storeAck: true });
    this.replacePendingWithMessage(hashStr);
  }

  public async markSent(
    requestId: RequestId,
    sentMessage: IDecodedMessage
  ): Promise<void> {
    const entry = this.pendingRequests.get(requestId);

    if (!entry || !entry.codec || !entry.messageRequest) {
      return;
    }

    entry.lastSentAt = Number(sentMessage.timestamp);
    entry.sentMessage = sentMessage;
    this.pendingMessages.set(sentMessage.hashStr, requestId);
  }

  public async queue(
    codec: ICodec<IDecodedMessage>,
    message: IMessage
  ): Promise<RequestId> {
    const requestId = uuidv4();

    this.pendingRequests.set(requestId.toString(), {
      codec,
      messageRequest: message,
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
    const res: Array<{
      requestId: string;
      codec: ICodec<IDecodedMessage>;
      message: IMessage;
    }> = [];

    for (const [requestId, entry] of this.pendingRequests.entries()) {
      const isAcknowledged = entry.filterAck || entry.storeAck;

      if (!entry.codec || !entry.messageRequest || isAcknowledged) {
        continue;
      }

      const notSent = !entry.lastSentAt;
      const notAcknowledged =
        entry.lastSentAt &&
        Date.now() - entry.lastSentAt >= this.resendIntervalMs &&
        !isAcknowledged;

      if (notSent || notAcknowledged) {
        res.push({
          requestId,
          codec: entry.codec,
          message: entry.messageRequest
        });
      }
    }

    return res;
  }

  private ackMessage(
    hashStr: MessageHashStr,
    ackParams: AddMessageOptions = {}
  ): void {
    let entry = this.messages.get(hashStr);

    if (entry) {
      entry.filterAck = ackParams.filterAck ?? entry.filterAck;
      entry.storeAck = ackParams.storeAck ?? entry.storeAck;
      return;
    }

    const requestId = this.pendingMessages.get(hashStr);

    if (!requestId) {
      return;
    }

    entry = this.pendingRequests.get(requestId);

    if (!entry) {
      return;
    }

    entry.filterAck = ackParams.filterAck ?? entry.filterAck;
    entry.storeAck = ackParams.storeAck ?? entry.storeAck;
  }

  private replacePendingWithMessage(hashStr: MessageHashStr): void {
    const requestId = this.pendingMessages.get(hashStr);

    if (!requestId) {
      return;
    }

    const entry = this.pendingRequests.get(requestId);

    if (!entry) {
      return;
    }

    this.pendingRequests.delete(requestId);
    this.pendingMessages.delete(hashStr);

    this.messages.set(hashStr, entry);
  }
}

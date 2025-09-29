import { IEncoder, ILightPush, IMessage } from "@waku/interfaces";

import type { MessageStore } from "./message_store.js";
import type { RequestId } from "./utils.js";

type SenderConstructorParams = {
  messageStore: MessageStore;
  lightPush: ILightPush;
};

export class Sender {
  private readonly messageStore: MessageStore;
  private readonly lightPush: ILightPush;

  private sendInterval: ReturnType<typeof setInterval> | null = null;

  public constructor(params: SenderConstructorParams) {
    this.messageStore = params.messageStore;
    this.lightPush = params.lightPush;
  }

  public start(): void {
    this.sendInterval = setInterval(() => void this.backgroundSend(), 1000);
  }

  public stop(): void {
    if (this.sendInterval) {
      clearInterval(this.sendInterval);
      this.sendInterval = null;
    }
  }

  public async send(encoder: IEncoder, message: IMessage): Promise<RequestId> {
    const requestId = await this.messageStore.queue(encoder, message);
    const response = await this.lightPush.send(encoder, message);

    if (response.successes.length > 0) {
      await this.messageStore.markSent(requestId);
    }

    return requestId;
  }

  private async backgroundSend(): Promise<void> {
    const pendingRequests = this.messageStore.getMessagesToSend();

    // todo: implement chunking, error handling, retry, etc.
    // todo: implement backoff and batching potentially
    for (const { requestId, encoder, message } of pendingRequests) {
      const response = await this.lightPush.send(encoder, message);

      if (response.successes.length > 0) {
        await this.messageStore.markSent(requestId);
      }
    }
  }
}

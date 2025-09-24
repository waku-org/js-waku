import { IEncoder, ILightPush, IMessage } from "@waku/interfaces";

import type { MessageStore } from "./message_store.js";

type SenderConstructorParams = {
  messageStore: MessageStore;
  lightPush: ILightPush;
};

export class Sender {
  private readonly messageStore: MessageStore;
  private readonly lightPush: ILightPush;

  public constructor(params: SenderConstructorParams) {
    this.messageStore = params.messageStore;
    this.lightPush = params.lightPush;
  }

  public async send(encoder: IEncoder, message: IMessage): Promise<void> {
    const requestId = await this.messageStore.queue(encoder, message);
    await this.lightPush.send(encoder, message);
    if (requestId) {
      await this.messageStore.markSent(requestId);
    }
  }
}

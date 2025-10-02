import {
  ICodec,
  IDecodedMessage,
  ILightPush,
  IMessage,
  IProtoMessage
} from "@waku/interfaces";

import { AckManager } from "./ack_manager.js";
import type { MessageStore } from "./message_store.js";
import type { RequestId } from "./utils.js";

type SenderConstructorParams = {
  messageStore: MessageStore;
  lightPush: ILightPush;
  ackManager: AckManager;
};

export class Sender {
  private readonly messageStore: MessageStore;
  private readonly lightPush: ILightPush;
  private readonly ackManager: AckManager;

  private sendInterval: ReturnType<typeof setInterval> | null = null;

  public constructor(params: SenderConstructorParams) {
    this.messageStore = params.messageStore;
    this.lightPush = params.lightPush;
    this.ackManager = params.ackManager;
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

  public async send(
    codec: ICodec<IDecodedMessage>,
    message: IMessage
  ): Promise<RequestId> {
    const requestId = await this.messageStore.queue(codec, message);

    await this.ackManager.subscribe(codec);

    const response = await this.lightPush.send(codec, message); // todo: add to light push return of proto message or decoded message

    if (response.successes.length > 0) {
      const protoObj = await codec.toProtoObj(message);
      const decodedMessage = await codec.fromProtoObj(
        codec.pubsubTopic,
        protoObj as IProtoMessage
      );

      await this.messageStore.markSent(requestId, decodedMessage!);
    }

    return requestId;
  }

  private async backgroundSend(): Promise<void> {
    const pendingRequests = this.messageStore.getMessagesToSend();

    for (const { requestId, codec, message } of pendingRequests) {
      const response = await this.lightPush.send(codec, message);

      if (response.successes.length > 0) {
        const protoObj = await codec.toProtoObj(message);
        const decodedMessage = await codec.fromProtoObj(
          codec.pubsubTopic,
          protoObj as IProtoMessage
        );

        await this.messageStore.markSent(
          requestId,
          decodedMessage as IDecodedMessage
        );
      }
    }
  }
}

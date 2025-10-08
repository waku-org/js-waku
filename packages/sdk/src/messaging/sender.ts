import { createDecoder, createEncoder } from "@waku/core";
import {
  ILightPush,
  ISendMessage,
  NetworkConfig,
  RequestId
} from "@waku/interfaces";
import { createRoutingInfo } from "@waku/utils";

import { AckManager } from "./ack_manager.js";
import type { MessageStore } from "./message_store.js";

type SenderConstructorParams = {
  messageStore: MessageStore;
  lightPush: ILightPush;
  ackManager: AckManager;
  networkConfig: NetworkConfig;
};

const DEFAULT_SEND_INTERVAL = 1000;

export class Sender {
  private readonly messageStore: MessageStore;
  private readonly lightPush: ILightPush;
  private readonly ackManager: AckManager;
  private readonly networkConfig: NetworkConfig;

  private readonly processingRequests: Set<RequestId> = new Set();

  private sendInterval: ReturnType<typeof setInterval> | null = null;

  public constructor(params: SenderConstructorParams) {
    this.messageStore = params.messageStore;
    this.lightPush = params.lightPush;
    this.ackManager = params.ackManager;
    this.networkConfig = params.networkConfig;
  }

  public start(): void {
    this.sendInterval = setInterval(
      () => void this.backgroundSend(),
      DEFAULT_SEND_INTERVAL
    );
  }

  public stop(): void {
    if (this.sendInterval) {
      clearInterval(this.sendInterval);
      this.sendInterval = null;
    }
  }

  public async send(message: ISendMessage): Promise<RequestId> {
    const requestId = await this.messageStore.queue(message);

    await this.ackManager.subscribe(message.contentTopic);
    await this.sendMessage(requestId, message);

    return requestId;
  }

  private async backgroundSend(): Promise<void> {
    const pendingRequests = this.messageStore.getMessagesToSend();

    for (const { requestId, message } of pendingRequests) {
      await this.sendMessage(requestId, message);
    }
  }

  private async sendMessage(
    requestId: RequestId,
    message: ISendMessage
  ): Promise<void> {
    try {
      if (this.processingRequests.has(requestId)) {
        return;
      }

      this.processingRequests.add(requestId);

      const encoder = createEncoder({
        contentTopic: message.contentTopic,
        routingInfo: createRoutingInfo(this.networkConfig, {
          contentTopic: message.contentTopic
        }),
        ephemeral: message.ephemeral
      });

      const decoder = createDecoder(
        message.contentTopic,
        createRoutingInfo(this.networkConfig, {
          contentTopic: message.contentTopic
        })
      );

      const response = await this.lightPush.send(
        encoder,
        {
          payload: message.payload
        },
        {
          // force no retry as we have retry implemented in the sender
          autoRetry: false,
          // send to only one peer as we will retry on failure and need to ensure only one message is in the network
          numPeersToUse: 1
        }
      );

      if (response?.messages && response.messages.length > 0) {
        const decodedMessage = await decoder.fromProtoObj(
          decoder.pubsubTopic,
          response.messages[0]
        );

        this.messageStore.markSent(requestId, decodedMessage!);
      } else {
        // do nothing on failure, will retry
      }
    } finally {
      this.processingRequests.delete(requestId);
    }
  }
}

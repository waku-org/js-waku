import { createDecoder, createEncoder } from "@waku/core";
import {
  IDecodedMessage,
  ILightPush,
  IProtoMessage,
  NetworkConfig
} from "@waku/interfaces";
import { createRoutingInfo } from "@waku/utils";

import { AckManager } from "./ack_manager.js";
import type { MessageStore } from "./message_store.js";
import type { RequestId, WakuLikeMessage } from "./utils.js";

type SenderConstructorParams = {
  messageStore: MessageStore;
  lightPush: ILightPush;
  ackManager: AckManager;
  networkConfig: NetworkConfig;
};

export class Sender {
  private readonly messageStore: MessageStore;
  private readonly lightPush: ILightPush;
  private readonly ackManager: AckManager;
  private readonly networkConfig: NetworkConfig;

  private sendInterval: ReturnType<typeof setInterval> | null = null;

  public constructor(params: SenderConstructorParams) {
    this.messageStore = params.messageStore;
    this.lightPush = params.lightPush;
    this.ackManager = params.ackManager;
    this.networkConfig = params.networkConfig;
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

  public async send(wakuLikeMessage: WakuLikeMessage): Promise<RequestId> {
    const requestId = await this.messageStore.queue(wakuLikeMessage);

    await this.ackManager.subscribe(wakuLikeMessage.contentTopic);

    const encoder = createEncoder({
      contentTopic: wakuLikeMessage.contentTopic,
      routingInfo: createRoutingInfo(this.networkConfig, {
        contentTopic: wakuLikeMessage.contentTopic
      }),
      ephemeral: wakuLikeMessage.ephemeral
    });

    const decoder = createDecoder(
      wakuLikeMessage.contentTopic,
      createRoutingInfo(this.networkConfig, {
        contentTopic: wakuLikeMessage.contentTopic
      })
    );

    const response = await this.lightPush.send(encoder, {
      payload: wakuLikeMessage.payload
    }); // todo: add to light push return of proto message or decoded message

    if (response.successes.length > 0) {
      const protoObj = await encoder.toProtoObj({
        payload: wakuLikeMessage.payload
      });
      const decodedMessage = await decoder.fromProtoObj(
        decoder.pubsubTopic,
        protoObj as IProtoMessage
      );

      await this.messageStore.markSent(requestId, decodedMessage!);
    }

    return requestId;
  }

  private async backgroundSend(): Promise<void> {
    const pendingRequests = this.messageStore.getMessagesToSend();

    for (const { requestId, message } of pendingRequests) {
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

      const response = await this.lightPush.send(encoder, {
        payload: message.payload
      });

      if (response.successes.length > 0) {
        const protoObj = await encoder.toProtoObj({
          payload: message.payload
        });
        const decodedMessage = await decoder.fromProtoObj(
          decoder.pubsubTopic,
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

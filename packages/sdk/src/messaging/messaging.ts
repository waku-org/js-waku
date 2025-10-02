import { IFilter, ILightPush, IStore, NetworkConfig } from "@waku/interfaces";

import { AckManager } from "./ack_manager.js";
import { MessageStore } from "./message_store.js";
import { Sender } from "./sender.js";
import type { RequestId, WakuLikeMessage } from "./utils.js";

interface IMessaging {
  send(wakuLikeMessage: WakuLikeMessage): Promise<RequestId>;
}

type MessagingConstructorParams = {
  lightPush: ILightPush;
  filter: IFilter;
  store: IStore;
  networkConfig: NetworkConfig;
};

export class Messaging implements IMessaging {
  private readonly messageStore: MessageStore;
  private readonly ackManager: AckManager;
  private readonly sender: Sender;

  public constructor(params: MessagingConstructorParams) {
    this.messageStore = new MessageStore();

    this.ackManager = new AckManager({
      messageStore: this.messageStore,
      filter: params.filter,
      store: params.store,
      networkConfig: params.networkConfig
    });

    this.sender = new Sender({
      messageStore: this.messageStore,
      lightPush: params.lightPush,
      ackManager: this.ackManager,
      networkConfig: params.networkConfig
    });
  }

  public start(): void {
    this.ackManager.start();
    this.sender.start();
  }

  public async stop(): Promise<void> {
    await this.ackManager.stop();
    this.sender.stop();
  }

  public send(wakuLikeMessage: WakuLikeMessage): Promise<RequestId> {
    return this.sender.send(wakuLikeMessage);
  }
}

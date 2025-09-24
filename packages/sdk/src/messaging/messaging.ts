import {
  IEncoder,
  IFilter,
  ILightPush,
  IMessage,
  IStore
} from "@waku/interfaces";

import { FilterAckManager } from "./fitler_ack.js";
import { MessageStore } from "./message_store.js";
import { StoreAckManager } from "./store_ack.js";

interface IMessaging {
  send(encoder: IEncoder, message: IMessage): Promise<void>;
}

type MessagingConstructorParams = {
  lightPush: ILightPush;
  filter: IFilter;
  store: IStore;
};

export class Messaging implements IMessaging {
  private readonly lightPush: ILightPush;
  private readonly messageStore: MessageStore;
  private readonly filterAckManager: FilterAckManager;
  private readonly storeAckManager: StoreAckManager;

  public constructor(params: MessagingConstructorParams) {
    this.lightPush = params.lightPush;
    this.messageStore = new MessageStore();
    this.filterAckManager = new FilterAckManager(
      this.messageStore,
      params.filter
    );
    this.storeAckManager = new StoreAckManager(this.messageStore, params.store);
  }

  public start(): void {
    this.filterAckManager.start();
    this.storeAckManager.start();
  }

  public async stop(): Promise<void> {
    await this.filterAckManager.stop();
    this.storeAckManager.stop();
  }

  public send(encoder: IEncoder, message: IMessage): Promise<void> {
    return (async () => {
      const hash = await this.messageStore.queue(encoder, message);
      await this.lightPush.send(encoder, message);
      if (hash) {
        this.messageStore.markSent(hash);
      }
    })();
  }
}

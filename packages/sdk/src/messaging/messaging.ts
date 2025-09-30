import {
  ICodec,
  IDecodedMessage,
  IFilter,
  ILightPush,
  IMessage,
  IStore
} from "@waku/interfaces";

import { AckManager } from "./ack_manager.js";
import { MessageStore } from "./message_store.js";
import { Sender } from "./sender.js";
import type { RequestId } from "./utils.js";

interface IMessaging {
  send(codec: ICodec<IDecodedMessage>, message: IMessage): Promise<RequestId>;
}

type MessagingConstructorParams = {
  lightPush: ILightPush;
  filter: IFilter;
  store: IStore;
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
      store: params.store
    });

    this.sender = new Sender({
      messageStore: this.messageStore,
      lightPush: params.lightPush
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

  public send(
    codec: ICodec<IDecodedMessage>,
    message: IMessage
  ): Promise<string> {
    return this.sender.send(codec, message);
  }
}

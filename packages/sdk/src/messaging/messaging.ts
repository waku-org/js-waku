import { messageHashStr } from "@waku/core";
import {
  IDecodedMessage,
  IEncoder,
  IFilter,
  ILightPush,
  IMessage,
  IStore
} from "@waku/interfaces";

interface IMessaging {
  send(encoder: IEncoder, message: IMessage): Promise<void>;
}

type MessagingConstructorParams = {
  lightPush: ILightPush;
  filter: IFilter;
  store: IStore;
};

export class Messaging implements IMessaging {
  public constructor(params: MessagingConstructorParams) {}

  public send(encoder: IEncoder, message: IMessage): Promise<void> {
    return Promise.resolve();
  }
}

class MessageStore {
  // const hash: { encoder, message, filterAck, storeAck }
  // filterAck(hash)
  // storeAck(hash)
  // markSent(hash)
  // queue(encoder, message)
  // getMessagesToSend()
  // -> not sent yet (first)
  // -> sent more than 2s ago but not acked yet (store or filter)
}

type ICodec = null;

interface IAckManager {
  start(): void;
  stop(): void;
  subscribe(codec: ICodec): void;
}

class FilterAckManager implements IAckManager {
  private subscriptions: Set<ICodec> = new Set();

  public constructor(
    private messageStore: MessageStore,
    private filter: IFilter
  ) {}

  public start(): void {}

  public stop(): void {}

  public async subscribe(codec: ICodec): Promise<boolean> {
    return this.filter.subscribe(codec, this.onMessage.bind(this));
  }

  private async onMessage(message: IDecodedMessage): Promise<void> {
    const hash = messageHashStr(message.pubsubTopic, message);

    if (this.messageStore.has(message)) {
      this.messageStore.markFilterAck(hash);
    } else {
      this.messageStore.put(message);
      this.messageStore.markFilterAck(hash);
    }
  }
}

class StoreAckManager implements IAckManager {
  public constructor(
    private messageStore: MessageStore,
    private store: IStore
  ) {}

  public start(): void {}

  public stop(): void {}

  public subscribe(codec: ICodec): void {}
}

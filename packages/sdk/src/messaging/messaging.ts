import {
  IDecodedMessage,
  IDecoder,
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

type ICodec = IEncoder & IDecoder<IDecodedMessage>;

interface IAckManager {
  start(): void;
  stop(): void;
  subscribe(codec: ICodec): void;
}

class FilterAckManager implements IAckManager {
  private codecs: Set<ICodec> = new Set();

  public constructor(
    private messageStore: MessageStore,
    private filter: IFilter
  ) {}

  public start(): void {
    // noop
  }

  public async stop(): Promise<void> {
    const promises = Array.from(this.codecs.entries()).map((codec) => {
      return this.filter.unsubscribe(codec);
    });

    await Promise.all(promises);
    this.codecs.clear();
  }

  public async subscribe(codec: ICodec): Promise<boolean> {
    return this.filter.subscribe(codec, this.onMessage.bind(this));
  }

  private async onMessage(message: IDecodedMessage): Promise<void> {
    if (!this.messageStore.has(message.hashStr)) {
      this.messageStore.add(message);
    }

    this.messageStore.markFilterAck(message.hashStr);
  }
}

class StoreAckManager implements IAckManager {
  private interval: ReturnType<typeof setInterval> | null = null;

  private codecs: Set<ICodec> = new Set();

  public constructor(
    private messageStore: MessageStore,
    private store: IStore
  ) {}

  public start(): void {
    if (this.interval) {
      return;
    }

    this.interval = setInterval(() => {
      void this.query();
    }, 1000);
  }

  public stop(): void {
    if (!this.interval) {
      return;
    }

    clearInterval(this.interval);
    this.interval = null;
  }

  public subscribe(codec: ICodec): void {
    this.codecs.add(codec);
  }

  private async query(): Promise<void> {
    for (const codec of this.codecs) {
      await this.store.queryWithOrderedCallback(
        [codec],
        (message) => {
          if (!this.messageStore.has(message.hashStr)) {
            this.messageStore.add(message);
          }

          this.messageStore.markStoreAck(message.hashStr);
        },
        {
          timeStart: new Date(Date.now() - 60 * 60 * 1000),
          timeEnd: new Date()
        }
      );
    }
  }
}

import { ICodec, IDecodedMessage, IFilter, IStore } from "@waku/interfaces";

import { MessageStore } from "./message_store.js";
import { IAckManager } from "./utils.js";

type AckManagerConstructorParams = {
  messageStore: MessageStore;
  filter: IFilter;
  store: IStore;
};

export class AckManager implements IAckManager {
  private readonly messageStore: MessageStore;
  private readonly filterAckManager: FilterAckManager;
  private readonly storeAckManager: StoreAckManager;

  public constructor(params: AckManagerConstructorParams) {
    this.messageStore = params.messageStore;

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

  public async subscribe(codec: ICodec<IDecodedMessage>): Promise<boolean> {
    return (
      (await this.filterAckManager.subscribe(codec)) ||
      (await this.storeAckManager.subscribe(codec))
    );
  }
}

class FilterAckManager implements IAckManager {
  private codecs: Set<ICodec<IDecodedMessage>> = new Set();

  public constructor(
    private messageStore: MessageStore,
    private filter: IFilter
  ) {}

  public start(): void {
    return;
  }

  public async stop(): Promise<void> {
    const promises = Array.from(this.codecs.entries()).map((codec) =>
      this.filter.unsubscribe(codec)
    );
    await Promise.all(promises);
    this.codecs.clear();
  }

  public async subscribe(codec: ICodec<IDecodedMessage>): Promise<boolean> {
    const success = await this.filter.subscribe(
      codec,
      this.onMessage.bind(this)
    );
    if (success) {
      this.codecs.add(codec);
    }
    return success;
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

  private codecs: Set<ICodec<IDecodedMessage>> = new Set();

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

  public async subscribe(codec: ICodec<IDecodedMessage>): Promise<boolean> {
    this.codecs.add(codec);
    return true;
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

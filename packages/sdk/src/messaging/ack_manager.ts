import { createDecoder } from "@waku/core";
import {
  IDecodedMessage,
  IDecoder,
  IFilter,
  IStore,
  NetworkConfig,
  SubscribeListener
} from "@waku/interfaces";
import { createRoutingInfo } from "@waku/utils";

import { MessageStore } from "./message_store.js";

type AckManagerConstructorParams = {
  messageStore: MessageStore;
  filter: IFilter;
  store: IStore;
  networkConfig: NetworkConfig;
};

export interface IAckManager {
  start(): void;
  stop(): void;
  observe(contentTopic: string): Promise<boolean>;
  subscribe(contentTopic: string, cb: SubscribeListener): Promise<boolean>;
  unsubscribe(contentTopic: string): Promise<void>;
}

export class AckManager implements IAckManager {
  private readonly messageStore: MessageStore;
  private readonly filterAckManager: FilterAckManager;
  private readonly storeAckManager: StoreAckManager;
  private readonly networkConfig: NetworkConfig;

  private readonly subscribedContentTopics: Set<string> = new Set();

  public constructor(params: AckManagerConstructorParams) {
    this.messageStore = params.messageStore;
    this.networkConfig = params.networkConfig;

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
    this.subscribedContentTopics.clear();
  }

  public async observe(contentTopic: string): Promise<boolean> {
    if (this.subscribedContentTopics.has(contentTopic)) {
      return true;
    }

    this.subscribedContentTopics.add(contentTopic);
    const decoder = createDecoder(
      contentTopic,
      createRoutingInfo(this.networkConfig, {
        contentTopic
      })
    );

    return (
      await Promise.all([
        this.filterAckManager.subscribe(decoder),
        this.storeAckManager.subscribe(decoder)
      ])
    ).some((success) => success);
  }

  public async subscribe(
    contentTopic: string,
    cb: SubscribeListener
  ): Promise<boolean> {
    const decoder = createDecoder(
      contentTopic,
      createRoutingInfo(this.networkConfig, {
        contentTopic
      })
    );

    return this.filterAckManager.subscribe(decoder, cb);
  }

  public async unsubscribe(contentTopic: string): Promise<void> {
    return this.filterAckManager.unsubscribe(contentTopic);
  }
}

class FilterAckManager {
  private decoders: Set<IDecoder<IDecodedMessage>> = new Set();

  public constructor(
    private messageStore: MessageStore,
    private filter: IFilter
  ) {
    this.onMessage = this.onMessage.bind(this);
  }

  public start(): void {
    return;
  }

  public async stop(): Promise<void> {
    const promises = Array.from(this.decoders.entries()).map((decoder) =>
      this.filter.unsubscribe(decoder)
    );
    await Promise.all(promises);
    this.decoders.clear();
  }

  public async subscribe(
    decoder: IDecoder<IDecodedMessage>,
    cb?: SubscribeListener
  ): Promise<boolean> {
    const success = await this.filter.subscribe(decoder, (message) => {
      try {
        cb?.(message);
      } catch (error) {
        // ignore
      }

      try {
        this.onMessage(message);
      } catch (error) {
        // ignore
      }
    });

    if (success) {
      this.decoders.add(decoder);
    }

    return success;
  }

  public async unsubscribe(contentTopic: string): Promise<void> {
    const decoders = Array.from(this.decoders).filter(
      (decoder) => decoder.contentTopic === contentTopic
    );

    const promises = decoders.map((decoder) =>
      this.filter.unsubscribe(decoder)
    );

    await Promise.all(promises);

    for (const decoder of decoders) {
      this.decoders.delete(decoder);
    }
  }

  private onMessage(message: IDecodedMessage): void {
    if (!this.messageStore.has(message.hashStr)) {
      this.messageStore.add(message, { filterAck: true });
    }

    this.messageStore.markFilterAck(message.hashStr);
  }
}

class StoreAckManager {
  private interval: ReturnType<typeof setInterval> | null = null;

  private decoders: Set<IDecoder<IDecodedMessage>> = new Set();

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
    }, 5000);
  }

  public stop(): void {
    if (!this.interval) {
      return;
    }

    clearInterval(this.interval);
    this.interval = null;
  }

  public async subscribe(decoder: IDecoder<IDecodedMessage>): Promise<boolean> {
    this.decoders.add(decoder);
    return true;
  }

  private async query(): Promise<void> {
    for (const decoder of this.decoders) {
      await this.store.queryWithOrderedCallback(
        [decoder],
        (message) => {
          if (!this.messageStore.has(message.hashStr)) {
            this.messageStore.add(message, { storeAck: true });
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

import { createDecoder } from "@waku/core";
import {
  IDecodedMessage,
  IDecoder,
  IFilter,
  IStore,
  NetworkConfig
} from "@waku/interfaces";
import { createRoutingInfo } from "@waku/utils";

import { MessageStore } from "./message_store.js";
import { IAckManager } from "./utils.js";

type AckManagerConstructorParams = {
  messageStore: MessageStore;
  filter: IFilter;
  store: IStore;
  networkConfig: NetworkConfig;
};

const DEFAULT_QUERY_INTERVAL = 5000;
const QUERY_TIME_WINDOW_MS = 60 * 60 * 1000;

export class AckManager implements IAckManager {
  private readonly messageStore: MessageStore;
  private readonly filterAckManager: FilterAckManager;
  private readonly storeAckManager: StoreAckManager;
  private readonly networkConfig: NetworkConfig;

  private readonly subscribedContentTopics: Set<string> = new Set();
  private readonly subscribingAttempts: Set<string> = new Set();

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

  public async subscribe(contentTopic: string): Promise<boolean> {
    if (
      this.subscribedContentTopics.has(contentTopic) ||
      this.subscribingAttempts.has(contentTopic)
    ) {
      return true;
    }

    this.subscribingAttempts.add(contentTopic);

    const decoder = createDecoder(
      contentTopic,
      createRoutingInfo(this.networkConfig, {
        contentTopic
      })
    );

    const promises = await Promise.all([
      this.filterAckManager.subscribe(decoder),
      this.storeAckManager.subscribe(decoder)
    ]);

    this.subscribedContentTopics.add(contentTopic);
    this.subscribingAttempts.delete(contentTopic);
    return promises.some((success) => success);
  }
}

class FilterAckManager {
  private decoders: Set<IDecoder<IDecodedMessage>> = new Set();

  public constructor(
    private messageStore: MessageStore,
    private filter: IFilter
  ) {}

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

  public async subscribe(decoder: IDecoder<IDecodedMessage>): Promise<boolean> {
    const success = await this.filter.subscribe(
      decoder,
      this.onMessage.bind(this)
    );
    if (success) {
      this.decoders.add(decoder);
    }
    return success;
  }

  private async onMessage(message: IDecodedMessage): Promise<void> {
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
    }, DEFAULT_QUERY_INTERVAL);
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
          timeStart: new Date(Date.now() - QUERY_TIME_WINDOW_MS),
          timeEnd: new Date()
        }
      );
    }
  }
}

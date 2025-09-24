import { IStore } from "@waku/interfaces";

import { MessageStore } from "./message_store.js";
import { IAckManager, ICodec } from "./utils.js";

export class StoreAckManager implements IAckManager {
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

  public async subscribe(codec: ICodec): Promise<boolean> {
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

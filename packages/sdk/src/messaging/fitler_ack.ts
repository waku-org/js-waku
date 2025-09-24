import { IDecodedMessage, IFilter } from "@waku/interfaces";

import { MessageStore } from "./message_store.js";
import { IAckManager, ICodec } from "./utils.js";

export class FilterAckManager implements IAckManager {
  private codecs: Set<ICodec> = new Set();

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

  public async subscribe(codec: ICodec): Promise<boolean> {
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

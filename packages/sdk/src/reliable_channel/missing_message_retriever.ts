import type {
  IDecodedMessage,
  IDecoder,
  QueryRequestParams
} from "@waku/interfaces";
import type { MessageId } from "@waku/sds";
import { Logger } from "@waku/utils";

const log = new Logger("sdk:missing-message-retriever");

const DEFAULT_RETRIEVE_FREQUENCY_MS = 10 * 1000; // 10 seconds

export class MissingMessageRetriever<T extends IDecodedMessage> {
  private retrieveInterval: ReturnType<typeof setInterval> | undefined;
  private missingMessages: Map<MessageId, Uint8Array<ArrayBufferLike>>; // Waku Message Ids
  private activeQueryPromise: Promise<void> | undefined;
  private abortController?: AbortController;

  public constructor(
    private readonly decoder: IDecoder<T>,
    private readonly retrieveFrequencyMs: number = DEFAULT_RETRIEVE_FREQUENCY_MS,
    private readonly _retrieve: <T extends IDecodedMessage>(
      decoders: IDecoder<T>[],
      options?: Partial<QueryRequestParams>
    ) => AsyncGenerator<Promise<T | undefined>[]>,
    private readonly onMessageRetrieved?: (message: T) => Promise<void>
  ) {
    this.missingMessages = new Map();
  }

  public start(): void {
    if (this.retrieveInterval) {
      clearInterval(this.retrieveInterval);
      this.retrieveInterval = undefined;
    }

    this.abortController = new AbortController();

    if (this.retrieveFrequencyMs !== 0) {
      log.info(`start retrieve loop every ${this.retrieveFrequencyMs}ms`);
      this.retrieveInterval = setInterval(() => {
        void this.retrieveMissingMessage();
      }, this.retrieveFrequencyMs);
    }
  }

  public async stop(): Promise<void> {
    log.info("Stopping MissingMessageRetriever...");

    if (this.retrieveInterval) {
      clearInterval(this.retrieveInterval);
      this.retrieveInterval = undefined;
    }

    if (this.abortController) {
      this.abortController.abort();
      this.abortController = undefined;
    }

    if (this.activeQueryPromise) {
      log.info("Waiting for active query to complete...");
      try {
        await this.activeQueryPromise;
      } catch (error) {
        log.warn("Active query failed during stop:", error);
      }
    }

    this.missingMessages.clear();
    log.info("MissingMessageRetriever stopped");
  }

  public addMissingMessage(
    messageId: MessageId,
    retrievalHint: Uint8Array
  ): void {
    if (!this.missingMessages.has(messageId)) {
      log.info("missing message notice", messageId, retrievalHint);
      this.missingMessages.set(messageId, retrievalHint);
    }
  }

  public removeMissingMessage(messageId: MessageId): void {
    if (this.missingMessages.has(messageId)) {
      this.missingMessages.delete(messageId);
    }
  }

  private async retrieveMissingMessage(): Promise<void> {
    if (this.missingMessages.size) {
      const messageHashes = Array.from(this.missingMessages.values());
      log.info("attempting to retrieve missing message", messageHashes.length);

      this.activeQueryPromise = (async () => {
        try {
          for await (const page of this._retrieve([this.decoder], {
            messageHashes,
            abortSignal: this.abortController?.signal
          })) {
            for await (const msg of page) {
              if (msg && this.onMessageRetrieved) {
                await this.onMessageRetrieved(msg);
              }
            }
          }
        } catch (error) {
          if (error instanceof Error && error.name === "AbortError") {
            log.info("Store query aborted");
            return;
          }
          log.error("Store query failed:", error);
        }
      })();

      await this.activeQueryPromise;
      this.activeQueryPromise = undefined;
    }
  }
}

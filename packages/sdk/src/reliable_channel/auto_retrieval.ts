import { TypedEventEmitter } from "@libp2p/interface";
import {
  HealthStatus,
  type IDecodedMessage,
  type IDecoder,
  IWakuEventEmitter,
  QueryRequestParams,
  WakuEventType
} from "@waku/interfaces";
import { Logger } from "@waku/utils";

import {
  IPeerManagerEvents,
  PeerManagerEventNames
} from "../peer_manager/peer_manager.js";

const log = new Logger("sdk:auto-retrieval");

export const DEFAULT_FORCE_QUERY_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
export const MAX_TIME_RANGE_QUERY_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface AutoRetrievalOptions {
  /**
   * Elapsed time since the last successful query, after which we proceed with
   * a store query, on a connection event, no matter the conditions.
   * @default [[DEFAULT_FORCE_QUERY_THRESHOLD_MS]]
   */
  forceQueryThresholdMs?: number;
}

export enum AutoRetrievalEvent {
  /**
   * A message has been retrieved.
   */
  MessagesRetrieved = "message:retrieved"
}

export type AutoRetrievalEvents = {
  [AutoRetrievalEvent.MessagesRetrieved]: CustomEvent<IDecodedMessage[]>;
};

/**
 * Proceed with time-range store queries after re-connection.
 * Partial implementation of [Waku P2P Reliability](https://github.com/waku-org/specs/blob/master/standards/application/p2p-reliability.md)
 *
 * @emits <T extends IDecodedMessage> message retrieved on "messages"
 */
export class AutoRetrieval<
  T extends IDecodedMessage
> extends TypedEventEmitter<AutoRetrievalEvents> {
  private lastSuccessfulQuery: number;
  private lastTimeOffline: number;
  private readonly forceQueryThresholdMs: number;

  public constructor(
    public decoders: IDecoder<T>[],
    private readonly peerManagerEventEmitter: TypedEventEmitter<IPeerManagerEvents>,
    private readonly wakuEventEmitter: IWakuEventEmitter,
    private readonly _retrieve: <T extends IDecodedMessage>(
      decoders: IDecoder<T>[],
      options?: Partial<QueryRequestParams>
    ) => AsyncGenerator<Promise<T | undefined>[]>,
    options?: AutoRetrievalOptions
  ) {
    super();
    this.lastSuccessfulQuery = 0;
    this.lastTimeOffline = 0;
    this.forceQueryThresholdMs =
      options?.forceQueryThresholdMs ?? DEFAULT_FORCE_QUERY_THRESHOLD_MS;
  }

  public start(): void {
    log.info("starting auto retrieval service");
    this.setupEventListeners();
  }

  public stop(): void {
    this.unsetEventListeners();
  }

  private maybeRetrieve(): void {
    log.info("maybe retrieve");
    const timeSinceLastQuery = Date.now() - this.lastSuccessfulQuery;
    // if we were marked as "offline" after last successful query
    // OR, last successful query was too long ago
    if (
      this.lastTimeOffline > this.lastSuccessfulQuery ||
      timeSinceLastQuery > this.forceQueryThresholdMs
    ) {
      this.retrieve().catch((err) =>
        log.error("Error retrieving messages", err)
      );
    }
  }

  private async retrieve(): Promise<void> {
    log.info("perform retrieval");
    const { timeStart, timeEnd } = this.queryTimeRange();
    try {
      // TODO: pass peer id so we use the peer we just connected to
      for await (const page of this._retrieve(this.decoders, {
        timeStart,
        timeEnd
      })) {
        const messages = [];
        for await (const message of page) {
          if (message) {
            messages.push(message);
          }
        }
        // Bundle the messages to help batch process by sds
        this.dispatchMessages(messages);
      }

      // Didn't throw, so it didn't fail
      this.lastSuccessfulQuery = Date.now();
    } catch (_e) {
      // query failed nothing to do.
    }
  }

  private queryTimeRange(): { timeStart: Date; timeEnd: Date } {
    return calculateTimeRange(
      Date.now(),
      this.lastSuccessfulQuery,
      MAX_TIME_RANGE_QUERY_MS
    );
  }

  private dispatchMessages<T extends IDecodedMessage>(messages: T[]): void {
    log.info("dispatching message");
    this.dispatchEvent(
      new CustomEvent<IDecodedMessage[]>(AutoRetrievalEvent.MessagesRetrieved, {
        detail: messages
      })
    );
  }

  private setupEventListeners(): void {
    this.peerManagerEventEmitter.addEventListener(
      PeerManagerEventNames.StoreConnect,
      this.maybeRetrieve.bind(this)
    );

    this.wakuEventEmitter.addEventListener(
      WakuEventType.Health,
      this.updateLastOfflineDate.bind(this)
    );
  }

  private unsetEventListeners(): void {
    this.peerManagerEventEmitter.removeEventListener(
      PeerManagerEventNames.StoreConnect,
      this.maybeRetrieve.bind(this)
    );

    this.wakuEventEmitter.removeEventListener(
      WakuEventType.Health,
      this.updateLastOfflineDate.bind(this)
    );
  }

  private updateLastOfflineDate(event: CustomEvent<HealthStatus>): void {
    if (event.detail === HealthStatus.Unhealthy) {
      this.lastTimeOffline = Date.now();
    }
  }
}

export function calculateTimeRange(
  now: number,
  lastSuccessfulQuery: number,
  maxTimeRangeQueryMs: number
): { timeStart: Date; timeEnd: Date } {
  const timeRange = Math.min(now - lastSuccessfulQuery, maxTimeRangeQueryMs);
  const timeStart = new Date(now - timeRange);
  const timeEnd = new Date(now);
  return { timeStart, timeEnd };
}

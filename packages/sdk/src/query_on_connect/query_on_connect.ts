import { type PeerId, TypedEventEmitter } from "@libp2p/interface";
import {
  HealthStatus,
  type IDecodedMessage,
  type IDecoder,
  IWakuEventEmitter,
  QueryRequestParams,
  WakuEvent
} from "@waku/interfaces";
import { Logger } from "@waku/utils";

import {
  IPeerManagerEvents,
  PeerManagerEventNames
} from "../peer_manager/peer_manager.js";

const log = new Logger("sdk:query-on-connect");

export const DEFAULT_FORCE_QUERY_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
export const MAX_TIME_RANGE_QUERY_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface QueryOnConnectOptions {
  /**
   * Elapsed time since the last successful query, after which we proceed with
   * a store query, on a connection event, no matter the conditions.
   * @default [[DEFAULT_FORCE_QUERY_THRESHOLD_MS]]
   */
  forceQueryThresholdMs?: number;
}

export enum QueryOnConnectEvent {
  /**
   * A message has been retrieved.
   */
  MessagesRetrieved = "messages:retrieved"
}

export type QueryOnConnectEvents = {
  [QueryOnConnectEvent.MessagesRetrieved]: CustomEvent<IDecodedMessage[]>;
};

/**
 * Proceed with time-range store queries after connection to a store node.
 * Partial implementation of [Waku P2P Reliability](https://github.com/waku-org/specs/blob/master/standards/application/p2p-reliability.md)
 *
 * @emits <T extends IDecodedMessage> message retrieved on "messages"
 */
export class QueryOnConnect<
  T extends IDecodedMessage
> extends TypedEventEmitter<QueryOnConnectEvents> {
  private lastSuccessfulQuery: number;
  private lastTimeOffline: number;
  private readonly forceQueryThresholdMs: number;

  public constructor(
    public decoders: IDecoder<T>[],
    private readonly peerManagerEventEmitter: TypedEventEmitter<IPeerManagerEvents>,
    private readonly wakuEventEmitter: IWakuEventEmitter,
    private readonly _queryGenerator: <T extends IDecodedMessage>(
      decoders: IDecoder<T>[],
      options?: Partial<QueryRequestParams>
    ) => AsyncGenerator<Promise<T | undefined>[]>,
    options?: QueryOnConnectOptions
  ) {
    super();
    this.lastSuccessfulQuery = 0;
    this.lastTimeOffline = 0;
    this.forceQueryThresholdMs =
      options?.forceQueryThresholdMs ?? DEFAULT_FORCE_QUERY_THRESHOLD_MS;
  }

  public start(): void {
    log.info("starting query-on-connect service");
    this.setupEventListeners();
  }

  public stop(): void {
    this.unsetEventListeners();
  }

  /**
   * Mainly exposed for testing. Only use if you know what you are doing.
   *
   * Proceed with a query if:
   * - No successful query has happened
   * - OR, We detected that we were offline since last successful query
   * - OR, It bas been more than `forceQueryThresholdMs` than last query
   *
   * [[QueryOnConnect]] handles the listening to event to call this function.
   *
   * @param peerId A store peer id. Must be passed as we expect this to be trigger
   * upon a detected connection to a store peer.
   */
  private async maybeQuery(peerId: PeerId): Promise<void> {
    const timeSinceLastQuery = Date.now() - this.lastSuccessfulQuery;
    log.info(
      `maybe do store query to ${peerId.toString()}`,
      this.lastSuccessfulQuery,
      this.lastTimeOffline,
      timeSinceLastQuery,
      this.forceQueryThresholdMs
    );

    if (
      this.lastSuccessfulQuery === 0 ||
      this.lastTimeOffline > this.lastSuccessfulQuery ||
      timeSinceLastQuery > this.forceQueryThresholdMs
    ) {
      await this.query(peerId);
    } else {
      log.info(`no querying`);
    }
  }

  private async query(peerId: PeerId): Promise<void> {
    log.info(`perform store query to ${peerId.toString()}`);
    const { timeStart, timeEnd } = this.queryTimeRange();
    try {
      for await (const page of this._queryGenerator(this.decoders, {
        timeStart,
        timeEnd,
        peerId
      })) {
        // Await for decoding
        const messages = (await Promise.all(page)).filter(
          (m) => m !== undefined
        );
        // Bundle the messages to help batch process by sds
        this.dispatchMessages(messages);
      }

      // Didn't throw, so it didn't fail
      this.lastSuccessfulQuery = Date.now();
    } catch (err) {
      log.warn(`store query to ${peerId.toString()} failed`, err);
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
    log.info(
      "dispatching messages",
      messages.map((m) => m.hashStr)
    );
    this.dispatchEvent(
      new CustomEvent<IDecodedMessage[]>(
        QueryOnConnectEvent.MessagesRetrieved,
        {
          detail: messages
        }
      )
    );
  }

  private setupEventListeners(): void {
    this.peerManagerEventEmitter.addEventListener(
      PeerManagerEventNames.StoreConnect,
      (event) =>
        void this.maybeQuery(event.detail).catch((err) =>
          log.error("query-on-connect error", err)
        )
    );

    this.wakuEventEmitter.addEventListener(
      WakuEvent.Health,
      this.updateLastOfflineDate.bind(this)
    );
  }

  private unsetEventListeners(): void {
    this.peerManagerEventEmitter.removeEventListener(
      PeerManagerEventNames.StoreConnect,
      (event) =>
        void this.maybeQuery(event.detail).catch((err) =>
          log.error("query-on-connect error", err)
        )
    );

    this.wakuEventEmitter.removeEventListener(
      WakuEvent.Health,
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

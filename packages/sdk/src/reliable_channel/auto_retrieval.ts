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

const DEFAULT_FORCE_QUERY_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
const MAX_TIME_RANGE_QUERY_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface AutoRetrievalOptions {
  /**
   * Elapsed time since the last successful query, after which we proceed with
   * a store query, on a connection event, no matter the conditions.
   * @default [[DEFAULT_FORCE_QUERY_THRESHOLD_MS]]
   */
  forceQueryThresholdMs?: number;
}

export interface AutoRetrievalEvents {
  message: CustomEvent<IDecodedMessage>;
}
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
    this.setupEventListeners();
  }

  public stop(): void {
    this.unsetEventListeners();
  }

  private maybeRetrieve(): void {
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
    const { timeStart, timeEnd } = this.queryTimeRangeMs();
    try {
      // TODO: pass peer id so we use the peer we just connected to
      for await (const page of this._retrieve(this.decoders, {
        timeStart,
        timeEnd
      })) {
        for await (const message of page) {
          if (message) {
            this.dispatchMessage(message);
          }
        }
      }

      // Didn't throw, so it didn't fail
      this.lastSuccessfulQuery = Date.now();
    } catch (_e) {
      // query failed nothing to do.
    }
  }

  private queryTimeRangeMs(): { timeStart: Date; timeEnd: Date } {
    const timeEnd = new Date();

    const timeRange = Math.max(
      timeEnd.valueOf() - this.lastSuccessfulQuery,
      MAX_TIME_RANGE_QUERY_MS
    );
    const timeStart = new Date(timeEnd.valueOf() - timeRange);

    return { timeStart, timeEnd };
  }

  private dispatchMessage<T extends IDecodedMessage>(message: T): void {
    this.dispatchEvent(
      new CustomEvent<IDecodedMessage>("message", { detail: message })
    );
  }

  private setupEventListeners(): void {
    this.peerManagerEventEmitter.addEventListener(
      PeerManagerEventNames.StoreConnect,
      this.maybeRetrieve
    );

    this.wakuEventEmitter.addEventListener(
      WakuEventType.Health,
      this.updateLastOfflineDate
    );
  }

  private unsetEventListeners(): void {
    this.peerManagerEventEmitter.removeEventListener(
      PeerManagerEventNames.StoreConnect,
      this.maybeRetrieve
    );

    this.wakuEventEmitter.removeEventListener(
      WakuEventType.Health,
      this.updateLastOfflineDate
    );
  }

  private updateLastOfflineDate(event: CustomEvent<HealthStatus>): void {
    if (event.detail === HealthStatus.Unhealthy) {
      this.lastTimeOffline = Date.now();
    }
  }
}

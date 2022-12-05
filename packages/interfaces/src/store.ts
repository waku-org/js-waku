import type { DecodedMessage, Decoder } from "./message.js";
import type { PointToPointProtocol, ProtocolOptions } from "./protocols.js";

export enum PageDirection {
  BACKWARD = "backward",
  FORWARD = "forward",
}

export interface TimeFilter {
  startTime: Date;
  endTime: Date;
}

export interface Index {
  digest?: Uint8Array;
  receivedTime?: bigint;
  senderTime?: bigint;
  pubsubTopic?: string;
}

export type Cursor = {
  digest?: Uint8Array;
  senderTime?: bigint;
  pubsubTopic?: string;
};

export type StoreQueryOptions = {
  /**
   * The direction in which pages are retrieved:
   * - { @link PageDirection.BACKWARD }: Most recent page first.
   * - { @link PageDirection.FORWARD }: Oldest page first.
   *
   * Note: This does not affect the ordering of messages with the page
   * (the oldest message is always first).
   *
   * @default { @link PageDirection.BACKWARD }
   */
  pageDirection?: PageDirection;
  /**
   * The number of message per page.
   */
  pageSize?: number;
  /**
   * Retrieve messages with a timestamp within the provided values.
   */
  timeFilter?: TimeFilter;
  /**
   * Cursor as an index to start a query from.
   */
  cursor?: Cursor;
} & ProtocolOptions;

export interface Store extends PointToPointProtocol {
  queryOrderedCallback: <T extends DecodedMessage>(
    decoders: Decoder<T>[],
    callback: (message: T) => Promise<void | boolean> | boolean | void,
    options?: StoreQueryOptions
  ) => Promise<void>;
  queryCallbackOnPromise: <T extends DecodedMessage>(
    decoders: Decoder<T>[],
    callback: (
      message: Promise<T | undefined>
    ) => Promise<void | boolean> | boolean | void,
    options?: StoreQueryOptions
  ) => Promise<void>;
  queryGenerator: <T extends DecodedMessage>(
    decoders: Decoder<T>[],
    options?: StoreQueryOptions
  ) => AsyncGenerator<Promise<T | undefined>[]>;
}

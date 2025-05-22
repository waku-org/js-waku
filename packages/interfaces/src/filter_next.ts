import type { IDecodedMessage, IDecoder } from "./message.js";
import type { Callback } from "./protocols.js";

export type INextFilter = {
  subscribe<T extends IDecodedMessage>(
    decoders: IDecoder<T>,
    callback: Callback<T>
  ): Promise<boolean>;

  unsubscribe<T extends IDecodedMessage>(
    decoders: IDecoder<T>
  ): Promise<boolean>;
};

export type NextFilterOptions = {
  /**
   * Interval with which Filter subscription will attempt to send ping requests to subscribed peers.
   *
   * @default 60_000
   */
  keepAliveIntervalMs: number;

  /**
   * Number of failed pings allowed to make to a remote peer before attempting to subscribe to a new one.
   *
   * @default 3
   */
  pingsBeforePeerRenewed: number;

  /**
   * Number of peers to be used for establishing subscriptions.
   *
   * @default 2
   */
  numPeersToUse: number;
};

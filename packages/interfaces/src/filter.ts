import type { IDecodedMessage, IDecoder } from "./message.js";
import type { Callback } from "./protocols.js";

export type IFilter = {
  readonly multicodec: string[];

  /**
   * Subscribes to messages that match the filtering criteria defined in the specified decoders.
   * Executes a callback upon receiving each message.
   * Checks for a valid peer connection before starting. Will wait until a peer is available.
   *
   * @param decoders - One or more decoders that specify the filtering criteria for this subscription.
   * @param callback - Function called when a message matching the filtering criteria is received.
   * @returns Promise that resolves to boolean indicating if the subscription was created successfully.
   *
   * @example
   * // Subscribe to a single decoder
   * await filter.subscribe(decoder, (msg) => console.log(msg));
   *
   * @example
   * // Subscribe to multiple decoders with the same pubsub topic
   * await filter.subscribe([decoder1, decoder2], (msg) => console.log(msg));
   *
   * @example
   * // Handle subscription failure
   * const success = await filter.subscribe(decoder, handleMessage);
   * if (!success) {
   *   console.error("Failed to subscribe");
   * }
   */
  subscribe<T extends IDecodedMessage>(
    decoders: IDecoder<T> | IDecoder<T>[],
    callback: Callback<T>
  ): Promise<boolean>;

  /**
   * Unsubscribes from messages with specified decoders.
   *
   * @param decoders - Single decoder or array of decoders to unsubscribe from. All decoders must share the same pubsubTopic.
   * @returns Promise that resolves to true if unsubscription was successful, false otherwise.
   *
   * @example
   * // Unsubscribe from a single decoder
   * await filter.unsubscribe(decoder);
   *
   * @example
   * // Unsubscribe from multiple decoders at once
   * await filter.unsubscribe([decoder1, decoder2]);
   *
   * @example
   * // Handle unsubscription failure
   * const success = await filter.unsubscribe(decoder);
   * if (!success) {
   *   console.error("Failed to unsubscribe");
   * }
   */
  unsubscribe<T extends IDecodedMessage>(
    decoders: IDecoder<T> | IDecoder<T>[]
  ): Promise<boolean>;

  /**
   * Unsubscribes from all active subscriptions across all pubsub topics.
   *
   * @example
   * // Clean up all subscriptions when React component unmounts
   * useEffect(() => {
   *   return () => filter.unsubscribeAll();
   * }, [filter]);
   *
   * @example
   * // Reset subscriptions and start over
   * filter.unsubscribeAll();
   * await filter.subscribe(newDecoder, newCallback);
   */
  unsubscribeAll(): void;
};

export type FilterProtocolOptions = {
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

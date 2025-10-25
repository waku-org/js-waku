import { TypedEventEmitter } from "@libp2p/interface";

/**
 * Helper function to wait for an event with an optional predicate.
 * Useful for replacing delay-based polling in tests.
 *
 * @param emitter - The event emitter to listen to
 * @param eventName - The name of the event to wait for
 * @param predicate - Optional function to filter events by detail
 * @param timeoutMs - Timeout in milliseconds (default: 5000)
 * @returns Promise that resolves with the event detail
 *
 * @example
 * ```typescript
 * const messageId = await waitForEvent<string>(
 *   channel,
 *   "message-acknowledged",
 *   (id) => id === expectedId
 * );
 * ```
 */
export function waitForEvent<T>(
  emitter: TypedEventEmitter<any>,
  eventName: string,
  predicate?: (detail: T) => boolean,
  timeoutMs: number = 5000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      emitter.removeEventListener(eventName, handler);
      reject(new Error(`Timeout waiting for event: ${eventName}`));
    }, timeoutMs);

    const handler = (event: CustomEvent<T>): void => {
      if (!predicate || predicate(event.detail)) {
        clearTimeout(timeout);
        emitter.removeEventListener(eventName, handler);
        resolve(event.detail);
      }
    };

    emitter.addEventListener(eventName, handler);
  });
}

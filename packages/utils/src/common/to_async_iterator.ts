import type {
  IAsyncIterator,
  IDecodedMessage,
  IDecoder,
  IReceiver,
  Unsubscribe
} from "@waku/interfaces";

/**
 * Options for configuring the behavior of an iterator.
 *
 * @property timeoutMs - Optional timeout in milliseconds. If specified, the iterator will terminate after this time period.
 * @property iteratorDelay - Optional delay in milliseconds between each iteration. Can be used to control the rate of iteration.
 */
export type IteratorOptions = {
  timeoutMs?: number;
  iteratorDelay?: number;
};

const FRAME_RATE = 60;

/**
 * Function that transforms IReceiver subscription to iterable stream of data.
 * @param receiver - object that allows to be subscribed to;
 * @param decoder - parameter to be passed to receiver for subscription;
 * @param options - options for receiver for subscription;
 * @param iteratorOptions - optional configuration for iterator;
 * @returns iterator and stop function to terminate it.
 */
export async function toAsyncIterator(
  receiver: IReceiver,
  decoder: IDecoder | IDecoder[],
  iteratorOptions?: IteratorOptions
): Promise<IAsyncIterator> {
  const iteratorDelay = iteratorOptions?.iteratorDelay ?? FRAME_RATE;

  const messages: IDecodedMessage[] = [];

  let unsubscribe: undefined | Unsubscribe;
  unsubscribe = await receiver.subscribeWithUnsubscribe(
    decoder,
    (message: IDecodedMessage) => {
      messages.push(message);
    }
  );

  const isWithTimeout = Number.isInteger(iteratorOptions?.timeoutMs);
  const timeoutMs = iteratorOptions?.timeoutMs ?? 0;
  const startTime = Date.now();

  async function* iterator(): AsyncIterator<IDecodedMessage> {
    while (true) {
      if (isWithTimeout && Date.now() - startTime >= timeoutMs) {
        return;
      }

      await wait(iteratorDelay);

      const message = messages.shift() as IDecodedMessage;

      if (!unsubscribe && messages.length === 0) {
        return message;
      }

      if (!message && unsubscribe) {
        continue;
      }

      yield message;
    }
  }

  return {
    iterator: iterator(),
    async stop() {
      if (unsubscribe) {
        await unsubscribe();
        unsubscribe = undefined;
      }
    }
  };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

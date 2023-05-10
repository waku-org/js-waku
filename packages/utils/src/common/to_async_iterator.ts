import type {
  IAsyncIterator,
  IDecodedMessage,
  IDecoder,
  IReceiver,
  ProtocolOptions,
  Unsubscribe,
} from "@waku/interfaces";

export async function toAsyncIterator<T extends IDecodedMessage>(
  receiver: IReceiver,
  decoder: IDecoder<T> | IDecoder<T>[],
  options?: ProtocolOptions
): Promise<IAsyncIterator<T>> {
  const messages: T[] = [];

  let unsubscribe: undefined | Unsubscribe;
  unsubscribe = await receiver.subscribe(
    decoder,
    (message: T) => {
      messages.push(message);
    },
    options
  );

  async function* iterator(): AsyncIterator<T> {
    while (true) {
      const message = messages.shift() as T;

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
    },
  };
}

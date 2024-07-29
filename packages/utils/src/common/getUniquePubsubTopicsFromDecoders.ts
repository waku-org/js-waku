import { IDecodedMessage, IDecoder } from "@waku/interfaces";

export function getUniquePubsubTopicsFromDecoders<T extends IDecodedMessage>(
  decoders: IDecoder<T> | IDecoder<T>[]
): string[] {
  if (!Array.isArray(decoders)) {
    return [decoders.pubsubTopic];
  }

  if (decoders.length === 0) {
    return [];
  }

  const pubsubTopics = new Set(decoders.map((d) => d.pubsubTopic));

  return [...pubsubTopics];
}

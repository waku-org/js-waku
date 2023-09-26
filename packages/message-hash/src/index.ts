import { sha256 } from "@noble/hashes/sha256";
import type { IProtoMessage } from "@waku/interfaces";
import { concat, utf8ToBytes } from "@waku/utils/bytes";

/**
 * Deterministic Message Hashing as defined in
 * [14/WAKU2-MESSAGE](https://rfc.vac.dev/spec/14/#deterministic-message-hashing)
 */
export function messageHash(
  pubSubTopic: string,
  message: IProtoMessage
): Uint8Array {
  const pubsubTopicBytes = utf8ToBytes(pubSubTopic);
  const contentTopicBytes = utf8ToBytes(message.contentTopic);

  let bytes;

  if (message.meta) {
    bytes = concat([
      pubsubTopicBytes,
      message.payload,
      contentTopicBytes,
      message.meta
    ]);
  } else {
    bytes = concat([pubsubTopicBytes, message.payload, contentTopicBytes]);
  }
  return sha256(bytes);
}

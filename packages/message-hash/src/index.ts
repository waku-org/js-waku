import { sha256 } from "@noble/hashes/sha256";
import type { IProtoMessage } from "@waku/interfaces";
import { concat, utf8ToBytes } from "@waku/utils/bytes";

/**
 * Deterministic Message Hashing as defined in
 * [14/WAKU2-MESSAGE](https://rfc.vac.dev/spec/14/#deterministic-message-hashing)
 */
export function messageHash(
  pubsubTopic: string,
  message: IProtoMessage
): Uint8Array {
  const pubsubTopicBytes = utf8ToBytes(pubsubTopic);
  const contentTopicBytes = utf8ToBytes(message.contentTopic);

  let bytesToHash;

  if (message.meta) {
    bytesToHash = concat([
      pubsubTopicBytes,
      message.payload,
      contentTopicBytes,
      message.meta,
    ]);
  } else {
    bytesToHash = concat([
      pubsubTopicBytes,
      message.payload,
      contentTopicBytes,
    ]);
  }
  return sha256(bytesToHash);
}

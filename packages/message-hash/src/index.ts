import { sha256 } from "@noble/hashes/sha256";
import type { IProtoMessage } from "@waku/interfaces";
import {
  bytesToUtf8,
  concat,
  numberToBytes,
  utf8ToBytes
} from "@waku/utils/bytes";

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

  let bytes;
  if (message.meta && message.timestamp) {
    const timestampBytes = numberToBytes(message.timestamp);
    bytes = concat([
      pubsubTopicBytes,
      message.payload,
      contentTopicBytes,
      message.meta,
      timestampBytes
    ]);
  } else if (message.meta) {
    bytes = concat([
      pubsubTopicBytes,
      message.payload,
      contentTopicBytes,
      message.meta
    ]);
  } else if (message.timestamp) {
    const timestampBytes = numberToBytes(message.timestamp);
    bytes = concat([
      pubsubTopicBytes,
      message.payload,
      contentTopicBytes,
      timestampBytes
    ]);
  } else {
    bytes = concat([pubsubTopicBytes, message.payload, contentTopicBytes]);
  }
  return sha256(bytes);
}

export function messageHashStr(
  pubsubTopic: string,
  message: IProtoMessage
): string {
  const hash = messageHash(pubsubTopic, message);
  const hashStr = bytesToUtf8(hash);
  return hashStr;
}

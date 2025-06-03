import { sha256 } from "@noble/hashes/sha256";
import type { IDecodedMessage, IProtoMessage } from "@waku/interfaces";
import { isDefined } from "@waku/utils";
import {
  bytesToHex,
  concat,
  numberToBytes,
  utf8ToBytes
} from "@waku/utils/bytes";

/**
 * Deterministic Message Hashing as defined in
 * [14/WAKU2-MESSAGE](https://rfc.vac.dev/spec/14/#deterministic-message-hashing)
 *
 * Computes a SHA-256 hash of the concatenation of pubsub topic, payload, content topic, meta, and timestamp.
 *
 * @param pubsubTopic - The pubsub topic string
 * @param message - The message to be hashed
 * @returns A Uint8Array containing the SHA-256 hash
 *
 * @example
 * ```typescript
 * import { messageHash } from "@waku/core";
 *
 * const pubsubTopic = "/waku/2/default-waku/proto";
 * const message = {
 *   payload: new Uint8Array([1, 2, 3, 4]),
 *   contentTopic: "/waku/2/default-content/proto",
 *   meta: new Uint8Array([5, 6, 7, 8]),
 *   timestamp: new Date()
 * };
 *
 * const hash = messageHash(pubsubTopic, message);
 * ```
 */
export function messageHash(
  pubsubTopic: string,
  message: IProtoMessage | IDecodedMessage
): Uint8Array {
  const pubsubTopicBytes = utf8ToBytes(pubsubTopic);
  const contentTopicBytes = utf8ToBytes(message.contentTopic);
  const timestampBytes = tryConvertTimestampToBytes(message.timestamp);

  const bytes = concat(
    [
      pubsubTopicBytes,
      message.payload,
      contentTopicBytes,
      message.meta,
      timestampBytes
    ].filter(isDefined)
  );

  return sha256(bytes);
}

function tryConvertTimestampToBytes(
  timestamp: Date | number | bigint | undefined
): undefined | Uint8Array {
  if (!timestamp) {
    return;
  }

  let bigIntTimestamp: bigint;

  if (typeof timestamp === "bigint") {
    bigIntTimestamp = timestamp;
  } else {
    bigIntTimestamp = BigInt(timestamp.valueOf()) * 1000000n;
  }

  return numberToBytes(bigIntTimestamp);
}

/**
 * Computes a deterministic message hash and returns it as a hexadecimal string.
 * This is a convenience wrapper around messageHash that converts the result to a hex string.
 *
 * @param pubsubTopic - The pubsub topic string
 * @param message - The message to be hashed
 * @returns A string containing the hex representation of the SHA-256 hash
 *
 * @example
 * ```typescript
 * import { messageHashStr } from "@waku/core";
 *
 * const pubsubTopic = "/waku/2/default-waku/proto";
 * const message = {
 *   payload: new Uint8Array([1, 2, 3, 4]),
 *   contentTopic: "/waku/2/default-content/proto",
 *   meta: new Uint8Array([5, 6, 7, 8]),
 *   timestamp: new Date()
 * };
 *
 * const hashString = messageHashStr(pubsubTopic, message);
 * console.log(hashString); // e.g. "a1b2c3d4..."
 * ```
 */
export function messageHashStr(
  pubsubTopic: string,
  message: IProtoMessage | IDecodedMessage
): string {
  const hash = messageHash(pubsubTopic, message);
  const hashStr = bytesToHex(hash);
  return hashStr;
}

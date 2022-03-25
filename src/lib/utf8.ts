/**
 * Decode bytes to utf-8 string.
 */
import { fromString } from "uint8arrays/from-string";
import { toString } from "uint8arrays/to-string";

export const bytesToUtf8 = (bytes: Uint8Array): string =>
  toString(bytes, "utf-8");

/**
 * Encode utf-8 string to byte array
 */
export const utf8ToBytes = (s: string): Uint8Array => fromString(s, "utf-8");

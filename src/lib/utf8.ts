/**
 * Decode bytes to utf-8 string.
 */
import { fromString } from "uint8arrays/from-string";
import { toString } from "uint8arrays/to-string";

export const bytesToUtf8 = (b: Uint8Array): string => toString(b, "utf8");

/**
 * Encode utf-8 string to byte array
 */
export const utf8ToBytes = (s: string): Uint8Array => fromString(s, "utf8");

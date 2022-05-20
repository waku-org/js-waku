import { fromString } from "uint8arrays/from-string";
import { toString } from "uint8arrays/to-string";

/**
 * Convert input to a byte array.
 *
 * Handles both `0x` prefixed and non-prefixed strings.
 */
export function hexToBytes(hex: string | Uint8Array): Uint8Array {
  if (typeof hex === "string") {
    const _hex = hex.replace(/^0x/i, "");
    return fromString(_hex, "base16");
  }
  return hex;
}

/**
 * Convert byte array to hex string (no `0x` prefix).
 */
export const bytesToHex = (bytes: Uint8Array): string =>
  toString(bytes, "base16");

/**
 * Decode byte array to utf-8 string.
 */
export const bytesToUtf8 = (b: Uint8Array): string => toString(b, "utf8");

/**
 * Encode utf-8 string to byte array.
 */
export const utf8ToBytes = (s: string): Uint8Array => fromString(s, "utf8");

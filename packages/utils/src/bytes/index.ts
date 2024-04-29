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
    return fromString(_hex.toLowerCase(), "base16");
  }
  return hex;
}

export function numberToBytes(value: number | bigint): Uint8Array {
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);

  if (typeof value === "number") {
    view.setFloat64(0, value, false);
  } else {
    view.setBigInt64(0, value, false);
  }

  return new Uint8Array(buffer);
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

/**
 * Concatenate using Uint8Arrays as `Buffer` has a different behavior with `DataView`
 */
export function concat(
  byteArrays: Uint8Array[],
  totalLength?: number
): Uint8Array {
  const len =
    totalLength ?? byteArrays.reduce((acc, curr) => acc + curr.length, 0);
  const res = new Uint8Array(len);

  let offset = 0;
  for (const bytes of byteArrays) {
    res.set(bytes, offset);
    offset += bytes.length;
  }
  return res;
}

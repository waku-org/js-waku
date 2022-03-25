import { keccak256, Message } from "js-sha3";
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
 * Return Keccak-256 of the input.
 */
export function keccak256Buf(message: Message): Uint8Array {
  return new Uint8Array(keccak256.arrayBuffer(message));
}

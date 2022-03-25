import { keccak256, Message } from "js-sha3";

/**
 * Convert input to a byte array.
 */
export function hexToBytes(hex: string | Uint8Array): Uint8Array {
  if (typeof hex === "string") {
    const _hex = hex.replace(/^0x/i, "");
    const bytes = [];
    for (let c = 0; c < _hex.length; c += 2)
      bytes.push(parseInt(_hex.substring(c, c + 2), 16));

    return new Uint8Array(bytes);
  }
  return hex;
}

/**
 * Convert byte array to hex string (no `0x` prefix).
 */
export function bytesToHex(bytes: Uint8Array): string {
  const hex = [];
  for (let i = 0; i < bytes.length; i++) {
    const current = bytes[i] < 0 ? bytes[i] + 256 : bytes[i];
    hex.push((current >>> 4).toString(16));
    hex.push((current & 0xf).toString(16));
  }
  return hex.join("");
}

/**
 * Return Keccak-256 of the input.
 */
export function keccak256Buf(message: Message): Uint8Array {
  return new Uint8Array(keccak256.arrayBuffer(message));
}

import { keccak256, Message } from "js-sha3";

/**
 * Convert input to a Buffer.
 */
export function hexToBuf(hex: string | Buffer | Uint8Array): Buffer {
  if (typeof hex === "string") {
    return Buffer.from(hex.replace(/^0x/i, ""), "hex");
  } else {
    return Buffer.from(hex);
  }
}

/**
 * Convert input to hex string (no `0x` prefix).
 */
export function bufToHex(buf: Uint8Array | Buffer | ArrayBuffer): string {
  const _buf = Buffer.from(buf);
  return _buf.toString("hex");
}

/**
 * Compare both inputs, return true if they represent the same byte array.
 */
export function equalByteArrays(
  a: Uint8Array | Buffer | string,
  b: Uint8Array | Buffer | string
): boolean {
  let aBuf: Buffer;
  let bBuf: Buffer;
  if (typeof a === "string") {
    aBuf = hexToBuf(a);
  } else {
    aBuf = Buffer.from(a);
  }

  if (typeof b === "string") {
    bBuf = hexToBuf(b);
  } else {
    bBuf = Buffer.from(b);
  }

  return aBuf.compare(bBuf) === 0;
}

/**
 * Return Keccak-256 of the input.
 */
export function keccak256Buf(message: Message): Buffer {
  return Buffer.from(keccak256.arrayBuffer(message));
}

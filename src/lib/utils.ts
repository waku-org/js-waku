import { keccak256, Message } from "js-sha3";

/**
 * Convert input to a Buffer.
 *
 * @deprecated Use `hexToBytes` instead.
 */
export function hexToBuf(hex: string | Buffer | Uint8Array): Buffer {
  if (typeof hex === "string") {
    return Buffer.from(hex.replace(/^0x/i, ""), "hex");
  } else {
    return Buffer.from(hex);
  }
}

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
 * Convert input to hex string (no `0x` prefix).
 *
 * @deprecated Use `bytesToHex` instead.
 */
export function bufToHex(buf: Uint8Array | Buffer | ArrayBuffer): string {
  const _buf = Buffer.from(buf);
  return _buf.toString("hex");
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
 * Compare both inputs, return true if they represent the same byte array.
 */
export function equalByteArrays(
  a: Uint8Array | string,
  b: Uint8Array | string
): boolean {
  let _a: string;
  let _b: string;
  if (typeof a === "string") {
    _a = a.replace(/^0x/i, "").toLowerCase();
  } else {
    _a = bytesToHex(a);
  }

  if (typeof b === "string") {
    _b = b.replace(/^0x/i, "").toLowerCase();
  } else {
    _b = bytesToHex(b);
  }

  return _a === _b;
}

/**
 * Return Keccak-256 of the input.
 */
export function keccak256Buf(message: Message): Buffer {
  return Buffer.from(keccak256.arrayBuffer(message));
}

/**
 * Convert base64 string to byte array.
 */
export function base64ToBytes(base64: string): Uint8Array {
  const e = new Map<string, number>();

  const len = base64.length;
  const res = [];
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  for (let i = 0; i < 64; i++) {
    e.set(A.charAt(i), i);
  }
  e.set("+", 62);
  e.set("/", 63);

  let b = 0,
    l = 0,
    a;
  for (let i = 0; i < len; i++) {
    const c = e.get(base64.charAt(i));
    if (c === undefined)
      throw new Error(`Invalid base64 character ${base64.charAt(i)}`);
    b = (b << 6) + c;
    l += 6;
    while (l >= 8) {
      ((a = (b >>> (l -= 8)) & 0xff) || i < len - 2) && res.push(a);
    }
  }
  return new Uint8Array(res);
}

/**
 * Convert byte array to base64 string.
 */
export async function bytesToBase64(bytes: Uint8Array): Promise<string> {
  const base64url: string = await new Promise((r) => {
    const reader = new window.FileReader();
    reader.onload = (): void => r(reader.result as string);
    reader.readAsDataURL(new Blob([bytes]));
  });
  const base64 = base64url.split(",", 2)[1];
  // We want URL and Filename Safe base64: https://datatracker.ietf.org/doc/html/rfc4648#section-5
  // Without trailing padding
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

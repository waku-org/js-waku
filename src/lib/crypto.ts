import { crypto, subtle } from "./crypto_subtle";

export { crypto, subtle };

export function randomBytes(size: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(size));
}

export function sha256(msg: ArrayBufferLike): Promise<ArrayBuffer> {
  return subtle.digest({ name: "SHA-256" }, msg);
}

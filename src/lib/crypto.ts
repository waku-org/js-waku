import nodeCrypto from "crypto";

// IE 11
declare global {
  interface Window {
    msCrypto?: Crypto;
  }

  interface Crypto {
    webkitSubtle?: SubtleCrypto;
  }
}

const crypto = window.crypto || window.msCrypto || nodeCrypto.webcrypto;
const subtle: SubtleCrypto = crypto.subtle || crypto.webkitSubtle;

if (subtle === undefined) {
  throw new Error("crypto and/or subtle api unavailable");
}

export { crypto, subtle };

export function randomBytes(size: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(size));
}

export function sha256(msg: ArrayBufferLike): Promise<ArrayBuffer> {
  return subtle.digest({ name: "SHA-256" }, msg);
}

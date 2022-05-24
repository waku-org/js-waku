import { getSubtle, randomBytes } from "../crypto";

export const KeySize = 32;
export const IvSize = 12;
export const TagSize = 16;

const Algorithm = { name: "AES-GCM", length: 128 };

export async function encrypt(
  iv: Uint8Array,
  key: Uint8Array,
  clearText: Uint8Array
): Promise<Uint8Array> {
  return getSubtle()
    .importKey("raw", key, Algorithm, false, ["encrypt"])
    .then((cryptoKey) =>
      getSubtle().encrypt({ iv, ...Algorithm }, cryptoKey, clearText)
    )
    .then((cipher) => new Uint8Array(cipher));
}

export async function decrypt(
  iv: Uint8Array,
  key: Uint8Array,
  cipherText: Uint8Array
): Promise<Uint8Array> {
  return getSubtle()
    .importKey("raw", key, Algorithm, false, ["decrypt"])
    .then((cryptoKey) =>
      getSubtle().decrypt({ iv, ...Algorithm }, cryptoKey, cipherText)
    )
    .then((clear) => new Uint8Array(clear));
}

export function generateIv(): Uint8Array {
  return randomBytes(IvSize);
}

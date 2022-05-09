import { getSubtle, randomBytes } from "../crypto";

export const KeySize = 32;
export const IvSize = 12;
export const TagSize = 16;

const Algorithm = { name: "AES-GCM", length: 128 };

export async function encrypt(
  iv: Buffer | Uint8Array,
  key: Buffer,
  clearText: Buffer
): Promise<Buffer> {
  return getSubtle()
    .importKey("raw", key, Algorithm, false, ["encrypt"])
    .then((cryptoKey) =>
      getSubtle().encrypt({ iv, ...Algorithm }, cryptoKey, clearText)
    )
    .then(Buffer.from);
}

export async function decrypt(
  iv: Buffer,
  key: Buffer,
  cipherText: Buffer
): Promise<Buffer> {
  return getSubtle()
    .importKey("raw", key, Algorithm, false, ["decrypt"])
    .then((cryptoKey) =>
      getSubtle().decrypt({ iv, ...Algorithm }, cryptoKey, cipherText)
    )
    .then(Buffer.from);
}

export function generateIv(): Uint8Array {
  return randomBytes(IvSize);
}

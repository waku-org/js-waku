import { IvSize, SymmetricKeySize } from './index';

declare global {
  interface Window {
    msCrypto?: Crypto;
  }
  interface Crypto {
    webkitSubtle?: SubtleCrypto;
  }
}

const crypto = window.crypto || window.msCrypto;
const subtle: SubtleCrypto = crypto.subtle || crypto.webkitSubtle;

const Algorithm = { name: 'AES-GCM', length: 128 };

if (subtle === undefined) {
  throw new Error('Failed to load Subtle CryptoAPI');
}

export async function encrypt(
  iv: Buffer | Uint8Array,
  key: Buffer,
  clearText: Buffer
): Promise<Buffer> {
  return subtle
    .importKey('raw', key, Algorithm, false, ['encrypt'])
    .then((cryptoKey) =>
      subtle.encrypt({ iv, ...Algorithm }, cryptoKey, clearText)
    )
    .then(Buffer.from);
}

export async function decrypt(
  iv: Buffer,
  key: Buffer,
  cipherText: Buffer
): Promise<Buffer> {
  return subtle
    .importKey('raw', key, Algorithm, false, ['decrypt'])
    .then((cryptoKey) =>
      subtle.decrypt({ iv, ...Algorithm }, cryptoKey, cipherText)
    )
    .then(Buffer.from);
}

export function generateKeyForSymmetricEnc(): Buffer {
  return crypto.getRandomValues(Buffer.alloc(SymmetricKeySize));
}

export function generateIv(): Uint8Array {
  const iv = new Uint8Array(IvSize);
  crypto.getRandomValues(iv);
  return iv;
}

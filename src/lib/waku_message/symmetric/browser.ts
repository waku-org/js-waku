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

/**
 * Proceed with symmetric encryption of `clearText` value.
 */
async function encrypt(
  iv: Buffer,
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

/**
 * Proceed with symmetric decryption of `cipherText` value.
 */
async function decrypt(
  iv: Buffer,
  key: Buffer,
  cipherText: Buffer
): Promise<Buffer> {
  return subtle
    .importKey('raw', key, Algorithm, false, ['decrypt'])
    .then((cryptoKey) =>
      subtle.encrypt({ iv, ...Algorithm }, cryptoKey, cipherText)
    )
    .then(Buffer.from);
}

/**
 * Generate a new private key for Symmetric encryption purposes.
 */
function generateKeyForSymmetricEnc(): Buffer {
  return crypto.getRandomValues(Buffer.alloc(SymmetricKeySize));
}

/**
 * Generate an Initialisation Vector (iv) for for Symmetric encryption purposes.
 */
function generateIv(): Buffer {
  return crypto.getRandomValues(Buffer.alloc(IvSize));
}

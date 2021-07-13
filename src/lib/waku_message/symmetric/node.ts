import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

import { IvSize, SymmetricKeySize } from './index';

const Algorithm = 'aes-256-gcm';

/**
 * Proceed with symmetric encryption of `clearText` value.
 */
export function encrypt(iv: Buffer, key: Buffer, clearText: Buffer): Buffer {
  const cipher = createCipheriv(Algorithm, key, iv);
  const a = cipher.update(clearText);
  const b = cipher.final();
  const tag = cipher.getAuthTag();
  return Buffer.concat([a, b, tag]);
}

/**
 * Proceed with symmetric decryption of `cipherText` value.
 */
export function decrypt(
  iv: Buffer,
  tag: Buffer,
  key: Buffer,
  cipherText: Buffer
): Buffer {
  const decipher = createDecipheriv(Algorithm, key, iv);
  decipher.setAuthTag(tag);
  const a = decipher.update(cipherText);
  const b = decipher.final();
  return Buffer.concat([a, b]);
}

/**
 * Generate a new private key for Symmetric encryption purposes.
 */
export function generateKeyForSymmetricEnc(): Buffer {
  return randomBytes(SymmetricKeySize);
}

/**
 * Generate an Initialisation Vector (iv) for for Symmetric encryption purposes.
 */
export function generateIv(): Buffer {
  return randomBytes(IvSize);
}

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

import { IvSize, SymmetricKeySize, TagSize } from './index';

const Algorithm = 'aes-256-gcm';

export async function encrypt(
  iv: Buffer | Uint8Array,
  key: Buffer,
  clearText: Buffer
): Promise<Buffer> {
  const cipher = createCipheriv(Algorithm, key, iv);
  const a = cipher.update(clearText);
  const b = cipher.final();
  const tag = cipher.getAuthTag();
  return Buffer.concat([a, b, tag]);
}

export async function decrypt(
  iv: Buffer,
  key: Buffer,
  data: Buffer
): Promise<Buffer> {
  const tagStart = data.length - TagSize;
  const cipherText = data.slice(0, tagStart);
  const tag = data.slice(tagStart);
  const decipher = createDecipheriv(Algorithm, key, iv);
  decipher.setAuthTag(tag);
  const a = decipher.update(cipherText);
  const b = decipher.final();
  return Buffer.concat([a, b]);
}

export function generateKeyForSymmetricEnc(): Buffer {
  return randomBytes(SymmetricKeySize);
}

export function generateIv(): Buffer {
  return randomBytes(IvSize);
}

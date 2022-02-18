import { KeyPair } from "../crypto";
import { utils } from "js-waku";

/**
 * Save keypair to storage, encrypted with password
 */
export async function saveKeyPairToStorage(
  EncryptionKeyPair: KeyPair,
  password: string
) {
  const { salt, iv, cipher } = await encryptKey(EncryptionKeyPair, password);

  const data = {
    salt: utils.bytesToHex(salt),
    iv: utils.bytesToHex(iv),
    cipher: utils.bytesToHex(cipher),
  };

  localStorage.setItem("cipherEncryptionKeyPair", JSON.stringify(data));
}

/**
 * Load keypair from storage, decrypted using password
 */
export async function loadKeyPairFromStorage(
  password: string
): Promise<KeyPair | undefined> {
  const str = localStorage.getItem("cipherEncryptionKeyPair");
  if (!str) return;
  const data = JSON.parse(str);

  const salt = utils.hexToBytes(data.salt);
  const iv = utils.hexToBytes(data.iv);
  const cipher = utils.hexToBytes(data.cipher);

  return await decryptKey(salt, iv, cipher, password);
}

/**
 * Use password user as key material for wrap key.
 */
function getKeyMaterial(password: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return window.crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );
}

/**
 * get key to store password
 */
function getWrapKey(keyMaterial: CryptoKey, salt: Uint8Array) {
  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypt encryption KeyPair using provided password.
 */
async function encryptKey(encryptionKeyPair: KeyPair, password: string) {
  const keyMaterial = await getKeyMaterial(password);
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const wrappingKey = await getWrapKey(keyMaterial, salt);

  const enc = new TextEncoder();
  const encodedKeyPair = enc.encode(JSON.stringify(encryptionKeyPair));

  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const cipher = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    wrappingKey,
    encodedKeyPair
  );

  return { salt, iv, cipher };
}

/**
 * Derive a key from a password, and use the key to decrypt the cipher key pair.
 */
async function decryptKey(
  salt: Uint8Array,
  iv: Uint8Array,
  cipherKeyPair: Uint8Array,
  password: string
): Promise<KeyPair | undefined> {
  const keyMaterial = await getKeyMaterial(password);
  const key = await getWrapKey(keyMaterial, salt);

  try {
    let decrypted = await window.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      key,
      cipherKeyPair
    );

    let dec = new TextDecoder();
    return JSON.parse(dec.decode(decrypted));
  } catch (e) {
    return;
  }
}

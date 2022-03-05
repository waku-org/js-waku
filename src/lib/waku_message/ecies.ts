import * as secp from "@noble/secp256k1";

import { randomBytes, sha256, subtle } from "../crypto";
import { hexToBytes } from "../utils";

/**
 * HKDF as implemented in go-ethereum.
 */
function kdf(secret: Uint8Array, outputLength: number): Promise<Uint8Array> {
  let ctr = 1;
  let written = 0;
  let willBeResult = Promise.resolve(new Uint8Array());
  while (written < outputLength) {
    const counters = new Uint8Array([ctr >> 24, ctr >> 16, ctr >> 8, ctr]);
    const countersSecret = new Uint8Array(counters.length + secret.length);
    countersSecret.set(counters, 0);
    countersSecret.set(secret, counters.length);
    const willBeHashResult = sha256(countersSecret);
    willBeResult = willBeResult.then((result) =>
      willBeHashResult.then((hashResult) => {
        const _hashResult = new Uint8Array(hashResult);
        const _res = new Uint8Array(result.length + _hashResult.length);
        _res.set(result, 0);
        _res.set(_hashResult, result.length);
        return _res;
      })
    );
    written += 32;
    ctr += 1;
  }
  return willBeResult;
}

function aesCtrEncrypt(
  counter: Uint8Array,
  key: ArrayBufferLike,
  data: ArrayBufferLike
): Promise<Uint8Array> {
  return subtle
    .importKey("raw", key, "AES-CTR", false, ["encrypt"])
    .then((cryptoKey) =>
      subtle.encrypt(
        { name: "AES-CTR", counter: counter, length: 128 },
        cryptoKey,
        data
      )
    )
    .then((bytes) => new Uint8Array(bytes));
}

function aesCtrDecrypt(
  counter: Uint8Array,
  key: ArrayBufferLike,
  data: ArrayBufferLike
): Promise<Uint8Array> {
  return subtle
    .importKey("raw", key, "AES-CTR", false, ["decrypt"])
    .then((cryptoKey) =>
      subtle.decrypt(
        { name: "AES-CTR", counter: counter, length: 128 },
        cryptoKey,
        data
      )
    )
    .then((bytes) => new Uint8Array(bytes));
}

function hmacSha256Sign(
  key: ArrayBufferLike,
  msg: ArrayBufferLike
): PromiseLike<Uint8Array> {
  const algorithm = { name: "HMAC", hash: { name: "SHA-256" } };
  return subtle
    .importKey("raw", key, algorithm, false, ["sign"])
    .then((cryptoKey) => subtle.sign(algorithm, cryptoKey, msg))
    .then((bytes) => new Uint8Array(bytes));
}

function hmacSha256Verify(
  key: ArrayBufferLike,
  msg: ArrayBufferLike,
  sig: ArrayBufferLike
): Promise<boolean> {
  const algorithm = { name: "HMAC", hash: { name: "SHA-256" } };
  const _key = subtle.importKey("raw", key, algorithm, false, ["verify"]);
  return _key.then((cryptoKey) =>
    subtle.verify(algorithm, cryptoKey, sig, msg)
  );
}

/**
 * Derive shared secret for given private and public keys.
 *
 * @param  privateKeyA Sender's private key (32 bytes)
 * @param  publicKeyB Recipient's public key (65 bytes)
 * @returns  A promise that resolves with the derived shared secret (Px, 32 bytes)
 * @throws Error If arguments are invalid
 */
function derive(privateKeyA: Uint8Array, publicKeyB: Uint8Array): Uint8Array {
  if (privateKeyA.length !== 32) {
    throw new Error(
      `Bad private key, it should be 32 bytes but it's actually ${privateKeyA.length} bytes long`
    );
  } else if (publicKeyB.length !== 65) {
    throw new Error(
      `Bad public key, it should be 65 bytes but it's actually ${publicKeyB.length} bytes long`
    );
  } else if (publicKeyB[0] !== 4) {
    throw new Error("Bad public key, a valid public key would begin with 4");
  } else {
    const px = secp.getSharedSecret(privateKeyA, publicKeyB, true);
    // Remove the compression prefix
    return new Uint8Array(hexToBytes(px).slice(1));
  }
}

/**
 * Encrypt message for given recipient's public key.
 *
 * @param  publicKeyTo Recipient's public key (65 bytes)
 * @param  msg The message being encrypted
 * @return A promise that resolves with the ECIES structure serialized
 */
export async function encrypt(
  publicKeyTo: Uint8Array,
  msg: Uint8Array
): Promise<Uint8Array> {
  const ephemPrivateKey = randomBytes(32);

  const sharedPx = await derive(ephemPrivateKey, publicKeyTo);

  const hash = await kdf(sharedPx, 32);

  const iv = randomBytes(16);
  const encryptionKey = hash.slice(0, 16);
  const cipherText = await aesCtrEncrypt(iv, encryptionKey, msg);

  const ivCipherText = new Uint8Array(iv.length + cipherText.length);
  ivCipherText.set(iv, 0);
  ivCipherText.set(cipherText, iv.length);

  const macKey = await sha256(hash.slice(16));
  const hmac = await hmacSha256Sign(macKey, ivCipherText);
  const ephemPublicKey = secp.getPublicKey(ephemPrivateKey, false);

  const cipher = new Uint8Array(
    ephemPublicKey.length + ivCipherText.length + hmac.length
  );
  let index = 0;
  cipher.set(ephemPublicKey, index);
  index += ephemPublicKey.length;
  cipher.set(ivCipherText, index);
  index += ivCipherText.length;
  cipher.set(hmac, index);
  return cipher;
}

const metaLength = 1 + 64 + 16 + 32;

/**
 * Decrypt message using given private key.
 *
 * @param privateKey A 32-byte private key of recipient of the message
 * @param encrypted ECIES serialized structure (result of ECIES encryption)
 * @returns The clear text
 * @throws Error If decryption fails
 */
export async function decrypt(
  privateKey: Uint8Array,
  encrypted: Uint8Array
): Promise<Uint8Array> {
  if (encrypted.length <= metaLength) {
    throw new Error(
      `Invalid Ciphertext. Data is too small. It should ba at least ${metaLength} bytes`
    );
  } else if (encrypted[0] !== 4) {
    throw new Error(
      `Not a valid ciphertext. It should begin with 4 but actually begin with ${encrypted[0]}`
    );
  } else {
    // deserialize
    const ephemPublicKey = encrypted.slice(0, 65);
    const cipherTextLength = encrypted.length - metaLength;
    const iv = encrypted.slice(65, 65 + 16);
    const cipherAndIv = encrypted.slice(65, 65 + 16 + cipherTextLength);
    const ciphertext = cipherAndIv.slice(16);
    const msgMac = encrypted.slice(65 + 16 + cipherTextLength);

    // check HMAC
    const px = derive(privateKey, ephemPublicKey);
    const hash = await kdf(px, 32);
    const [encryptionKey, macKey] = await sha256(hash.slice(16)).then(
      (macKey) => [hash.slice(0, 16), macKey]
    );

    if (!(await hmacSha256Verify(macKey, cipherAndIv, msgMac))) {
      throw new Error("Incorrect MAC");
    }

    return aesCtrDecrypt(iv, encryptionKey, ciphertext);
  }
}

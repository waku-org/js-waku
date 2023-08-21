import nodeCrypto from "crypto";

import {
  getPublicKey as secpGetPublicKey,
  sign as secpSign,
  etc as secpUtils
} from "@noble/secp256k1";
import sha3 from "js-sha3";

import { Asymmetric, Symmetric } from "../constants.js";

declare const self: Record<string, any> | undefined;

// Determine the correct crypto object for the environment
if (typeof self === "object" && "crypto" in self) {
  globalThis.crypto = self.crypto; // Browser environment
} else {
  globalThis.crypto = nodeCrypto.webcrypto as unknown as Crypto; // Node.js environment
}

export function getSubtle(): SubtleCrypto {
  if (globalThis.crypto && globalThis.crypto.subtle) {
    return globalThis.crypto.subtle;
  } else {
    throw new Error(
      "The environment doesn't have Crypto Subtle API (if in the browser, be sure to use to be in a secure context, ie, https)"
    );
  }
}

/**
 * Generate a new private key to be used for asymmetric encryption.
 *
 * Use {@link getPublicKey} to get the corresponding Public Key.
 */
export function generatePrivateKey(): Uint8Array {
  return secpUtils.randomBytes(Asymmetric.keySize);
}

/**
 * Generate a new symmetric key to be used for symmetric encryption.
 */

export function generateSymmetricKey(): Uint8Array {
  return secpUtils.randomBytes(Symmetric.keySize);
}

/**
 * Return the public key for the given private key, to be used for asymmetric
 * encryption.
 */
export const getPublicKey = secpGetPublicKey;

/**
 * ECDSA Sign a message with the given private key.
 *
 *  @param message The message to sign, usually a hash.
 *  @param privateKey The ECDSA private key to use to sign the message.
 *
 *  @returns The signature and the recovery id concatenated.
 */
export async function sign(
  message: Uint8Array,
  privateKey: Uint8Array
): Promise<Uint8Array> {
  const signatureObj = secpSign(message, privateKey);
  const signature = signatureObj.toCompactRawBytes();
  const recoveryId = signatureObj.recovery;

  if (recoveryId === undefined) {
    throw new Error("Recovery ID is undefined");
  }

  return new Uint8Array([...signature, recoveryId]);
}

export function keccak256(input: Uint8Array): Uint8Array {
  return new Uint8Array(sha3.keccak256.arrayBuffer(input));
}

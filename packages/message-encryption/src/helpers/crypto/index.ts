import nodeCrypto from "crypto";

import * as secp from "@noble/secp256k1";
import { concat } from "@waku/utils/bytes";
import sha3 from "js-sha3";

import { Asymmetric, Symmetric } from "../../constants.js";

declare const self: Record<string, any> | undefined;
const crypto: { node?: any; web?: any } = {
  node: nodeCrypto,
  web: typeof self === "object" && "crypto" in self ? self.crypto : undefined
};

export function getSubtle(): SubtleCrypto {
  if (crypto.web) {
    return crypto.web.subtle;
  } else if (crypto.node) {
    return crypto.node.webcrypto.subtle;
  } else {
    throw new Error(
      "The environment doesn't have Crypto Subtle API (if in the browser, be sure to use to be in a secure context, ie, https)"
    );
  }
}

export const randomBytes = secp.utils.randomBytes;
export const sha256 = secp.utils.sha256;

/**
 * Generate a new private key to be used for asymmetric encryption.
 *
 * Use {@link getPublicKey} to get the corresponding Public Key.
 */
export function generatePrivateKey(): Uint8Array {
  return randomBytes(Asymmetric.keySize);
}

/**
 * Generate a new symmetric key to be used for symmetric encryption.
 */
export function generateSymmetricKey(): Uint8Array {
  return randomBytes(Symmetric.keySize);
}

/**
 * Return the public key for the given private key, to be used for asymmetric
 * encryption.
 */
export const getPublicKey = secp.getPublicKey;

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
  const [signature, recoveryId] = await secp.sign(message, privateKey, {
    recovered: true,
    der: false
  });
  return concat(
    [signature, new Uint8Array([recoveryId])],
    signature.length + 1
  );
}

export function keccak256(input: Uint8Array): Uint8Array {
  return new Uint8Array(sha3.keccak256.arrayBuffer(input));
}

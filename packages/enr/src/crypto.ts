import {
  sign as nobleSign,
  ProjectivePoint as Point,
  Signature,
  verify
} from "@noble/secp256k1";
import { concat } from "@waku/utils/bytes";
import sha3 from "js-sha3";

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
  const signature = nobleSign(message, privateKey);
  return concat([
    signature.toCompactRawBytes(),
    new Uint8Array([signature.recovery || 0])
  ]);
}

export function keccak256(input: Uint8Array): Uint8Array {
  return new Uint8Array(sha3.keccak256.arrayBuffer(input));
}

export function compressPublicKey(publicKey: Uint8Array): Uint8Array {
  if (publicKey.length === 64) {
    publicKey = concat([new Uint8Array([4]), publicKey], 65);
  }
  const point = Point.fromHex(publicKey);
  return point.toRawBytes(true);
}

export function verifySignature(
  signature: Uint8Array,
  message: Uint8Array | string,
  publicKey: Uint8Array
): boolean {
  try {
    const _signature = Signature.fromCompact(signature.slice(0, 64));
    return verify(_signature, message, publicKey);
  } catch {
    return false;
  }
}

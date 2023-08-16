import * as secp from "@noble/secp256k1";
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

export function compressPublicKey(publicKey: Uint8Array): Uint8Array {
  if (publicKey.length === 64) {
    publicKey = concat([new Uint8Array([4]), publicKey], 65);
  }
  const point = secp.Point.fromHex(publicKey);
  return point.toRawBytes(true);
}

/**
 * Verify an ECDSA signature.
 */
export function verifySignature(
  signature: Uint8Array,
  message: Uint8Array | string,
  publicKey: Uint8Array
): boolean {
  try {
    const _signature = secp.Signature.fromCompact(signature.slice(0, 64));
    return secp.verify(_signature, message, publicKey);
  } catch {
    return false;
  }
}

import * as secp from "@noble/secp256k1";

import { keccak256 } from "../crypto";
import { bytesToHex } from "../utils";

import { NodeId } from "./types";

export function compressPublicKey(publicKey: Uint8Array): Uint8Array {
  const point = secp.Point.fromHex(bytesToHex(publicKey));
  return point.toRawBytes(true);
}

export async function sign(
  privKey: Uint8Array,
  msg: Uint8Array
): Promise<Uint8Array> {
  return secp.sign(keccak256(msg), privKey, {
    der: false,
  });
}

export function verify(
  pubKey: Uint8Array,
  msg: Uint8Array,
  sig: Uint8Array
): boolean {
  try {
    const _sig = secp.Signature.fromCompact(sig.slice(0, 64));
    return secp.verify(_sig, keccak256(msg), pubKey);
  } catch {
    return false;
  }
}

export function nodeId(pubKey: Uint8Array): NodeId {
  const publicKey = secp.Point.fromHex(pubKey);
  const uncompressedPubkey = publicKey.toRawBytes(false);

  return bytesToHex(keccak256(uncompressedPubkey.slice(1)));
}

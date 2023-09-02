import { sign as nobleSign, ProjectivePoint as Point } from "@noble/secp256k1";
import type { NodeId } from "@waku/interfaces";
import { bytesToHex } from "@waku/utils/bytes";

import { keccak256 } from "./crypto.js";

export async function sign(
  privKey: Uint8Array,
  msg: Uint8Array
): Promise<Uint8Array> {
  return nobleSign(keccak256(msg), privKey).toCompactRawBytes();
}

export function nodeId(pubKey: Uint8Array): NodeId {
  const publicKey = Point.fromHex(pubKey);
  const uncompressedPubkey = publicKey.toRawBytes(false);

  return bytesToHex(keccak256(uncompressedPubkey.slice(1)));
}

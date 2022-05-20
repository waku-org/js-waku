import * as secp from "@noble/secp256k1";

import { keccak256 } from "../crypto";
import { bytesToHex } from "../utils";

import { NodeId } from "./types";

export async function sign(
  privKey: Uint8Array,
  msg: Uint8Array
): Promise<Uint8Array> {
  return secp.sign(keccak256(msg), privKey, {
    der: false,
  });
}

export function nodeId(pubKey: Uint8Array): NodeId {
  const publicKey = secp.Point.fromHex(pubKey);
  const uncompressedPubkey = publicKey.toRawBytes(false);

  return bytesToHex(keccak256(uncompressedPubkey.slice(1)));
}

import * as secp from "@noble/secp256k1";

import { keccak256, randomBytes } from "../crypto";
import { bytesToHex } from "../utils";

import { createNodeId } from "./create";
import { NodeId } from "./types";

export function createPrivateKey(): Uint8Array {
  return randomBytes(32);
}

export function publicKey(privKey: Uint8Array): Uint8Array {
  return secp.getPublicKey(privKey, true);
}

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

  return createNodeId(keccak256(uncompressedPubkey.slice(1)));
}

export class ENRKeyPair {
  public constructor(
    public readonly nodeId: NodeId,
    public readonly privateKey: Uint8Array,
    public readonly publicKey: Uint8Array
  ) {}

  public static create(privateKey?: Uint8Array): ENRKeyPair {
    if (privateKey) {
      if (!secp.utils.isValidPrivateKey(privateKey)) {
        throw new Error("Invalid private key");
      }
    }
    const _privateKey = privateKey || createPrivateKey();
    const _publicKey = publicKey(_privateKey);
    const _nodeId = nodeId(_publicKey);

    return new ENRKeyPair(_nodeId, _privateKey, _publicKey);
  }

  public async sign(msg: Uint8Array): Promise<Uint8Array> {
    return sign(this.privateKey, msg);
  }

  public verify(msg: Uint8Array, sig: Uint8Array): boolean {
    return verify(this.publicKey, msg, sig);
  }
}

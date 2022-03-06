import { keccak256 } from "js-sha3";
import * as secp256k1 from "secp256k1";

import { randomBytes } from "../crypto";

import { createNodeId } from "./create";
import { NodeId } from "./types";

export function hash(input: Uint8Array): Uint8Array {
  return new Uint8Array(keccak256.arrayBuffer(input));
}

export function createPrivateKey(): Uint8Array {
  return randomBytes(32);
}

export function publicKey(privKey: Uint8Array): Uint8Array {
  return secp256k1.publicKeyCreate(privKey);
}

export function sign(privKey: Uint8Array, msg: Uint8Array): Uint8Array {
  const { signature } = secp256k1.ecdsaSign(hash(msg), privKey);
  return signature;
}

export function verify(
  pubKey: Uint8Array,
  msg: Uint8Array,
  sig: Uint8Array
): boolean {
  // Remove the recovery id if present (byte #65)
  return secp256k1.ecdsaVerify(sig.slice(0, 64), hash(msg), pubKey);
}

export function nodeId(pubKey: Uint8Array): NodeId {
  const uncompressedPubkey = secp256k1.publicKeyConvert(pubKey, false);

  return createNodeId(hash(uncompressedPubkey.slice(1)));
}

export class ENRKeyPair {
  public constructor(
    public readonly nodeId: NodeId,
    public readonly privateKey: Uint8Array,
    public readonly publicKey: Uint8Array
  ) {}

  public static create(privateKey?: Uint8Array): ENRKeyPair {
    if (privateKey) {
      if (!secp256k1.privateKeyVerify(privateKey)) {
        throw new Error("Invalid private key");
      }
    }
    const _privateKey = privateKey || createPrivateKey();
    const _publicKey = publicKey(_privateKey);
    const _nodeId = nodeId(_publicKey);

    return new ENRKeyPair(_nodeId, _privateKey, _publicKey);
  }

  public sign(msg: Uint8Array): Uint8Array {
    return sign(this.privateKey, msg);
  }

  public verify(msg: Uint8Array, sig: Uint8Array): boolean {
    return verify(this.publicKey, msg, sig);
  }
}

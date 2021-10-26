import { Buffer } from 'buffer';
import crypto from 'crypto';

import { keccak256 } from 'js-sha3';
import * as secp256k1 from 'secp256k1';

import { createNodeId } from './create';
import { NodeId } from './types';

export function hash(input: Uint8Array): Buffer {
  return Buffer.from(keccak256.arrayBuffer(input));
}

export async function createPrivateKey(): Promise<Buffer> {
  return Buffer.from(await randomBytes(32));
}

export function publicKey(privKey: Uint8Array): Buffer {
  return Buffer.from(secp256k1.publicKeyCreate(privKey));
}

export function sign(privKey: Uint8Array, msg: Uint8Array): Buffer {
  const { signature } = secp256k1.ecdsaSign(hash(msg), privKey);
  return Buffer.from(signature);
}

export function verify(pubKey: Buffer, msg: Buffer, sig: Buffer): boolean {
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
    public readonly privateKey: Buffer,
    public readonly publicKey: Buffer
  ) {}

  public static async create(privateKey?: Buffer): Promise<ENRKeyPair> {
    if (privateKey) {
      if (!secp256k1.privateKeyVerify(privateKey)) {
        throw new Error('Invalid private key');
      }
    }
    const _privateKey = privateKey || (await createPrivateKey());
    const _publicKey = publicKey(_privateKey);
    const _nodeId = nodeId(_publicKey);

    return new ENRKeyPair(_nodeId, _privateKey, _publicKey);
  }

  public sign(msg: Buffer): Buffer {
    return sign(this.privateKey, msg);
  }

  public verify(msg: Buffer, sig: Buffer): boolean {
    return verify(this.publicKey, msg, sig);
  }
}

function randomBytes(length: number): Uint8Array {
  if (typeof window !== 'undefined' && window && window.crypto) {
    const array = new Uint8Array(length);
    window.crypto.getRandomValues(array);
    return array;
  } else {
    return crypto.randomBytes(length);
  }
}

import crypto from "crypto";

import * as secp256k1 from "secp256k1";

import { AbstractKeypair, IKeypair, IKeypairClass, KeypairType } from "./types";

export function secp256k1PublicKeyToCompressed(
  publicKey: Uint8Array
): Uint8Array {
  if (publicKey.length === 64) {
    const _publicKey = new Uint8Array(publicKey.length + 1);
    _publicKey.set([4]);
    _publicKey.set(publicKey, 1);
    publicKey = _publicKey;
  }
  return secp256k1.publicKeyConvert(publicKey, true);
}

export function secp256k1PublicKeyToFull(publicKey: Uint8Array): Uint8Array {
  if (publicKey.length === 64) {
    const _publicKey = new Uint8Array(publicKey.length + 1);
    _publicKey.set([4]);
    _publicKey.set(publicKey, 1);
    publicKey = _publicKey;
  }
  return secp256k1.publicKeyConvert(publicKey, false);
}

export function secp256k1PublicKeyToRaw(publicKey: Uint8Array): Uint8Array {
  return secp256k1.publicKeyConvert(publicKey, false).slice(1);
}

export const Secp256k1Keypair: IKeypairClass = class Secp256k1Keypair
  extends AbstractKeypair
  implements IKeypair
{
  readonly type: KeypairType;

  constructor(privateKey?: Uint8Array, publicKey?: Uint8Array) {
    let pub = publicKey;
    if (pub) {
      pub = secp256k1PublicKeyToCompressed(pub);
    }
    super(privateKey, pub);
    this.type = KeypairType.secp256k1;
  }

  static async generate(): Promise<Secp256k1Keypair> {
    const privateKey = await randomBytes(32);
    const publicKey = secp256k1.publicKeyCreate(privateKey);
    return new Secp256k1Keypair(privateKey, publicKey);
  }

  privateKeyVerify(key = this._privateKey): boolean {
    if (key) {
      return secp256k1.privateKeyVerify(key);
    }
    return true;
  }

  publicKeyVerify(key = this._publicKey): boolean {
    if (key) {
      return secp256k1.publicKeyVerify(key);
    }
    return true;
  }

  sign(msg: Uint8Array): Uint8Array {
    const { signature, recid } = secp256k1.ecdsaSign(msg, this.privateKey);

    const result = new Uint8Array(signature.length + 1);
    result.set(signature);
    result.set([recid], signature.length);
    return result;
  }

  verify(msg: Uint8Array, sig: Uint8Array): boolean {
    return secp256k1.ecdsaVerify(sig, msg, this.publicKey);
  }
};

function randomBytes(length: number): Uint8Array {
  if (typeof window !== "undefined" && window && window.crypto) {
    const array = new Uint8Array(length);
    window.crypto.getRandomValues(array);
    return array;
  } else {
    return crypto.randomBytes(length);
  }
}

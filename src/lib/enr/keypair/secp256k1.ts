import { Buffer } from 'buffer';
import crypto from 'crypto';

import secp256k1 from 'secp256k1';

import { AbstractKeypair, IKeypair, IKeypairClass, KeypairType } from './types';

export function secp256k1PublicKeyToCompressed(publicKey: Uint8Array): Buffer {
  if (publicKey.length === 64) {
    publicKey = Buffer.concat([Buffer.from([4]), publicKey]);
  }
  return Buffer.from(secp256k1.publicKeyConvert(publicKey, true));
}

export function secp256k1PublicKeyToFull(publicKey: Uint8Array): Buffer {
  if (publicKey.length === 64) {
    return Buffer.concat([Buffer.from([4]), publicKey]);
  }
  return Buffer.from(secp256k1.publicKeyConvert(publicKey, false));
}

export function secp256k1PublicKeyToRaw(publicKey: Uint8Array): Buffer {
  return Buffer.from(secp256k1.publicKeyConvert(publicKey, false).slice(1));
}

export const Secp256k1Keypair: IKeypairClass = class Secp256k1Keypair
  extends AbstractKeypair
  implements IKeypair
{
  readonly type: KeypairType;

  constructor(privateKey?: Buffer, publicKey?: Buffer) {
    let pub = publicKey;
    if (pub) {
      pub = secp256k1PublicKeyToCompressed(pub);
    }
    super(privateKey, pub);
    this.type = KeypairType.secp256k1;
  }

  static async generate(): Promise<Secp256k1Keypair> {
    const privateKey = Buffer.from(await randomBytes(32));
    const publicKey = secp256k1.publicKeyCreate(privateKey);
    return new Secp256k1Keypair(privateKey, Buffer.from(publicKey));
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

  sign(msg: Buffer): Buffer {
    const { signature, recid } = secp256k1.ecdsaSign(msg, this.privateKey);
    return Buffer.concat([signature, Buffer.from([recid])]);
  }

  verify(msg: Buffer, sig: Buffer): boolean {
    return secp256k1.ecdsaVerify(sig, msg, this.publicKey);
  }
};

function randomBytes(length: number): Uint8Array {
  if (typeof window !== 'undefined' && window && window.crypto) {
    const array = new Uint8Array(length);
    window.crypto.getRandomValues(array);
    return array;
  } else {
    return crypto.randomBytes(length);
  }
}

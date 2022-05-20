import * as secp from "@noble/secp256k1";
import { concat } from "uint8arrays/concat";

import { randomBytes } from "../../crypto";

import { IKeypair, IKeypairClass, KeypairType } from "./types";

export function secp256k1PublicKeyToCompressed(
  publicKey: Uint8Array
): Uint8Array {
  if (publicKey.length === 64) {
    publicKey = concat([[4], publicKey], 65);
  }
  const point = secp.Point.fromHex(publicKey);
  return point.toRawBytes(true);
}

export function secp256k1PublicKeyToFull(publicKey: Uint8Array): Uint8Array {
  if (publicKey.length === 64) {
    publicKey = concat([[4], publicKey], 65);
  }
  const point = secp.Point.fromHex(publicKey);

  return point.toRawBytes(false);
}

export function secp256k1PublicKeyToRaw(publicKey: Uint8Array): Uint8Array {
  const point = secp.Point.fromHex(publicKey);
  return point.toRawBytes(false).slice(1);
}

export const Secp256k1Keypair: IKeypairClass = class Secp256k1Keypair
  implements IKeypair
{
  readonly type: KeypairType;
  _privateKey?: Uint8Array;
  readonly _publicKey?: Uint8Array;

  constructor(privateKey?: Uint8Array, publicKey?: Uint8Array) {
    let pub = publicKey;
    if (pub) {
      pub = secp256k1PublicKeyToCompressed(pub);
    }
    if ((this._privateKey = privateKey) && !this.privateKeyVerify()) {
      throw new Error("Invalid private key");
    }
    if ((this._publicKey = pub) && !this.publicKeyVerify()) {
      throw new Error("Invalid public key");
    }

    this.type = KeypairType.secp256k1;
  }

  static async generate(): Promise<Secp256k1Keypair> {
    const privateKey = randomBytes(32);
    const publicKey = secp.getPublicKey(privateKey);
    return new Secp256k1Keypair(privateKey, publicKey);
  }

  privateKeyVerify(key = this._privateKey): boolean {
    if (key) {
      return secp.utils.isValidPrivateKey(key);
    }
    return true;
  }

  publicKeyVerify(key = this._publicKey): boolean {
    if (key) {
      try {
        secp.Point.fromHex(key);
        return true;
      } catch {
        return false;
      }
    }
    return true;
  }

  verify(msg: Uint8Array, sig: Uint8Array): boolean {
    try {
      const _sig = secp.Signature.fromCompact(sig.slice(0, 64));
      return secp.verify(_sig, msg, this.publicKey);
    } catch {
      return false;
    }
  }

  get privateKey(): Uint8Array {
    if (!this._privateKey) {
      throw new Error();
    }
    return this._privateKey;
  }

  get publicKey(): Uint8Array {
    if (!this._publicKey) {
      throw new Error();
    }
    return this._publicKey;
  }

  hasPrivateKey(): boolean {
    return !!this._privateKey;
  }
};

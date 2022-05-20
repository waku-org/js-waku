import * as secp from "@noble/secp256k1";

import { compressPublicKey, randomBytes } from "../../crypto";

import { IKeypair, IKeypairClass, KeypairType } from "./types";

export const Secp256k1Keypair: IKeypairClass = class Secp256k1Keypair
  implements IKeypair
{
  readonly type: KeypairType;
  _privateKey?: Uint8Array;
  readonly _publicKey?: Uint8Array;

  constructor(privateKey?: Uint8Array, publicKey?: Uint8Array) {
    let pub = publicKey;
    if (pub) {
      pub = compressPublicKey(pub);
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

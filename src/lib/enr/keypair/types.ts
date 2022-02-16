export enum KeypairType {
  rsa = 0,
  ed25519 = 1,
  secp256k1 = 2,
}

export interface IKeypair {
  type: KeypairType;
  privateKey: Uint8Array;
  publicKey: Uint8Array;
  privateKeyVerify(): boolean;
  publicKeyVerify(): boolean;
  sign(msg: Uint8Array): Uint8Array;
  verify(msg: Uint8Array, sig: Uint8Array): boolean;
  hasPrivateKey(): boolean;
}

export interface IKeypairClass {
  new (privateKey?: Uint8Array, publicKey?: Uint8Array): IKeypair;
  generate(): Promise<IKeypair>;
}

export abstract class AbstractKeypair {
  _privateKey?: Uint8Array;
  readonly _publicKey?: Uint8Array;

  constructor(privateKey?: Uint8Array, publicKey?: Uint8Array) {
    if ((this._privateKey = privateKey) && !this.privateKeyVerify()) {
      throw new Error("Invalid private key");
    }
    if ((this._publicKey = publicKey) && !this.publicKeyVerify()) {
      throw new Error("Invalid private key");
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

  privateKeyVerify(): boolean {
    return true;
  }

  publicKeyVerify(): boolean {
    return true;
  }

  hasPrivateKey(): boolean {
    return Boolean(this._privateKey);
  }
}

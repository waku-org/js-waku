export enum KeypairType {
  rsa = 0,
  ed25519 = 1,
  secp256k1 = 2,
}

export interface IKeypair {
  type: KeypairType;
  privateKey: Buffer;
  publicKey: Buffer;
  privateKeyVerify(): boolean;
  publicKeyVerify(): boolean;
  sign(msg: Buffer): Buffer;
  verify(msg: Buffer, sig: Buffer): boolean;
  hasPrivateKey(): boolean;
}

export interface IKeypairClass {
  new (privateKey?: Buffer, publicKey?: Buffer): IKeypair;
  generate(): Promise<IKeypair>;
}

export abstract class AbstractKeypair {
  _privateKey?: Buffer;
  readonly _publicKey?: Buffer;

  constructor(privateKey?: Buffer, publicKey?: Buffer) {
    if ((this._privateKey = privateKey) && !this.privateKeyVerify()) {
      throw new Error("Invalid private key");
    }
    if ((this._publicKey = publicKey) && !this.publicKeyVerify()) {
      throw new Error("Invalid private key");
    }
  }

  get privateKey(): Buffer {
    if (!this._privateKey) {
      throw new Error();
    }
    return this._privateKey;
  }

  get publicKey(): Buffer {
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

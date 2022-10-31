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
  hasPrivateKey(): boolean;
}

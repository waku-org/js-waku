// TypeScript Version: 2.1
/// <reference types="node" />
declare module 'ecies-parity' {
  // Compute the public key for a given private key.
  export function getPublic(privateKey: Buffer): Buffer;

  // Compute the compressed public key for a given private key.
  export function getPublicCompressed(privateKey: Buffer): Buffer;

  // Create an ECDSA signature.
  export function sign(key: Buffer, msg: Buffer): Promise<Buffer>;

  // Verify an ECDSA signature.
  export function verify(
    publicKey: Buffer,
    msg: Buffer,
    sig: Buffer
  ): Promise<null>;

  // Derive shared secret for given private and public keys.
  export function derive(
    privateKeyA: Buffer,
    publicKeyB: Buffer
  ): Promise<Buffer>;

  // Input/output structure for ECIES operations.
  export interface Ecies {
    iv: Buffer;
    ephemPublicKey: Buffer;
    ciphertext: Buffer;
    mac: Buffer;
  }

  // Encrypt message for given recipient's public key.
  export function encrypt(
    publicKeyTo: Buffer,
    msg: Buffer,
    opts?: { iv?: Buffer; ephemPrivateKey?: Buffer }
  ): Promise<Buffer>;

  // Decrypt message using given private key.
  export function decrypt(privateKey: Buffer, payload: Buffer): Promise<Buffer>;
}

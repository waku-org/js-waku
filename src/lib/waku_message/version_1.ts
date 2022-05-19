import { Buffer } from "buffer";

import * as secp from "@noble/secp256k1";
import { keccak256 } from "js-sha3";

import { randomBytes } from "../crypto";
import { hexToBytes } from "../utils";

import * as ecies from "./ecies";
import * as symmetric from "./symmetric";

const FlagsLength = 1;
const FlagMask = 3; // 0011
const IsSignedMask = 4; // 0100
const PaddingTarget = 256;
const SignatureLength = 65;

export const PrivateKeySize = 32;

export type Signature = {
  signature: Uint8Array;
  publicKey: Uint8Array | undefined;
};

/**
 * Encode the payload pre-encryption.
 *
 * @internal
 * @param messagePayload: The payload to include in the message
 * @param sigPrivKey: If set, a signature using this private key is added.
 * @returns The encoded payload, ready for encryption using {@link encryptAsymmetric}
 * or {@link encryptSymmetric}.
 */
export async function clearEncode(
  messagePayload: Uint8Array,
  sigPrivKey?: Uint8Array
): Promise<{ payload: Uint8Array; sig?: Signature }> {
  let envelope = Buffer.from([0]); // No flags
  envelope = addPayloadSizeField(envelope, messagePayload);
  envelope = Buffer.concat([envelope, Buffer.from(messagePayload)]);

  // Calculate padding:
  let rawSize =
    FlagsLength +
    getSizeOfPayloadSizeField(messagePayload) +
    messagePayload.length;

  if (sigPrivKey) {
    rawSize += SignatureLength;
  }

  const remainder = rawSize % PaddingTarget;
  const paddingSize = PaddingTarget - remainder;
  const pad = Buffer.from(randomBytes(paddingSize));

  if (!validateDataIntegrity(pad, paddingSize)) {
    throw new Error("failed to generate random padding of size " + paddingSize);
  }

  envelope = Buffer.concat([envelope, pad]);

  let sig;
  if (sigPrivKey) {
    envelope[0] |= IsSignedMask;
    const hash = keccak256(envelope);
    const [signature, recid] = await secp.sign(hash, sigPrivKey, {
      recovered: true,
      der: false,
    });
    envelope = Buffer.concat([
      envelope,
      hexToBytes(signature),
      Buffer.from([recid]),
    ]);
    sig = {
      signature: Buffer.from(signature),
      publicKey: getPublicKey(sigPrivKey),
    };
  }

  return { payload: envelope, sig };
}

/**
 * Decode a decrypted payload.
 *
 * @internal
 */
export function clearDecode(
  message: Uint8Array | Buffer
): { payload: Uint8Array; sig?: Signature } | undefined {
  const buf = Buffer.from(message);
  let start = 1;
  let sig;

  const sizeOfPayloadSizeField = buf.readUIntLE(0, 1) & FlagMask;

  if (sizeOfPayloadSizeField === 0) return;

  const payloadSize = buf.readUIntLE(start, sizeOfPayloadSizeField);
  start += sizeOfPayloadSizeField;
  const payload = buf.slice(start, start + payloadSize);

  const isSigned = (buf.readUIntLE(0, 1) & IsSignedMask) == IsSignedMask;
  if (isSigned) {
    const signature = getSignature(buf);
    const hash = getHash(buf, isSigned);
    const publicKey = ecRecoverPubKey(hash, signature);
    sig = { signature, publicKey };
  }

  return { payload, sig };
}

/**
 * Proceed with Asymmetric encryption of the data as per [26/WAKU-PAYLOAD](https://rfc.vac.dev/spec/26/).
 * The data MUST be flags | payload-length | payload | [signature].
 * The returned result can be set to `WakuMessage.payload`.
 *
 * @internal
 */
export async function encryptAsymmetric(
  data: Uint8Array | Buffer,
  publicKey: Uint8Array | Buffer | string
): Promise<Uint8Array> {
  return ecies.encrypt(Buffer.from(hexToBytes(publicKey)), Buffer.from(data));
}

/**
 * Proceed with Asymmetric decryption of the data as per [26/WAKU-PAYLOAD](https://rfc.vac.dev/spec/26/).
 * The return data is expect to be flags | payload-length | payload | [signature].
 *
 * @internal
 */
export async function decryptAsymmetric(
  payload: Uint8Array | Buffer,
  privKey: Uint8Array | Buffer
): Promise<Uint8Array> {
  return ecies.decrypt(Buffer.from(privKey), Buffer.from(payload));
}

/**
 * Proceed with Symmetric encryption of the data as per [26/WAKU-PAYLOAD](https://rfc.vac.dev/spec/26/).
 *
 * @param data The data to encrypt, expected to be `flags | payload-length | payload | [signature]`.
 * @param key The key to use for encryption.
 * @returns The decrypted data, `cipherText | tag | iv` and can be set to `WakuMessage.payload`.
 *
 * @internal
 */
export async function encryptSymmetric(
  data: Uint8Array | Buffer,
  key: Uint8Array | Buffer | string
): Promise<Uint8Array> {
  const iv = symmetric.generateIv();

  // Returns `cipher | tag`
  const cipher = await symmetric.encrypt(
    iv,
    Buffer.from(hexToBytes(key)),
    Buffer.from(data)
  );
  return Buffer.concat([cipher, Buffer.from(iv)]);
}

/**
 * Proceed with Symmetric decryption of the data as per [26/WAKU-PAYLOAD](https://rfc.vac.dev/spec/26/).
 *
 * @param payload The cipher data, it is expected to be `cipherText | tag | iv`.
 * @param key The key to use for decryption.
 * @returns The decrypted data, expected to be `flags | payload-length | payload | [signature]`.
 *
 * @internal
 */
export async function decryptSymmetric(
  payload: Uint8Array | Buffer,
  key: Uint8Array | Buffer | string
): Promise<Uint8Array> {
  const data = Buffer.from(payload);
  const ivStart = data.length - symmetric.IvSize;
  const cipher = data.slice(0, ivStart);
  const iv = data.slice(ivStart);

  return symmetric.decrypt(iv, Buffer.from(hexToBytes(key)), cipher);
}

/**
 * Generate a new private key to be used for asymmetric encryption.
 *
 * Use {@link getPublicKey} to get the corresponding Public Key.
 */
export function generatePrivateKey(): Uint8Array {
  return randomBytes(PrivateKeySize);
}

/**
 * Generate a new symmetric key to be used for symmetric encryption.
 */
export function generateSymmetricKey(): Uint8Array {
  return randomBytes(symmetric.KeySize);
}

/**
 * Return the public key for the given private key, to be used for asymmetric
 * encryption.
 */
export function getPublicKey(privateKey: Uint8Array | Buffer): Uint8Array {
  return secp.getPublicKey(privateKey, false);
}

/**
 * Computes the flags & auxiliary-field as per [26/WAKU-PAYLOAD](https://rfc.vac.dev/spec/26/).
 */
function addPayloadSizeField(msg: Buffer, payload: Uint8Array): Buffer {
  const fieldSize = getSizeOfPayloadSizeField(payload);
  let field = Buffer.alloc(4);
  field.writeUInt32LE(payload.length, 0);
  field = field.slice(0, fieldSize);
  msg = Buffer.concat([msg, field]);
  msg[0] |= fieldSize;
  return msg;
}

/**
 * Returns the size of the auxiliary-field which in turns contains the payload size
 */
function getSizeOfPayloadSizeField(payload: Uint8Array): number {
  let s = 1;
  for (let i = payload.length; i >= 256; i /= 256) {
    s++;
  }
  return s;
}

function validateDataIntegrity(
  value: Uint8Array,
  expectedSize: number
): boolean {
  if (value.length !== expectedSize) {
    return false;
  }

  return !(
    expectedSize > 3 && Buffer.from(value).equals(Buffer.alloc(value.length))
  );
}

function getSignature(message: Buffer): Buffer {
  return message.slice(message.length - SignatureLength, message.length);
}

function getHash(message: Buffer, isSigned: boolean): string {
  if (isSigned) {
    return keccak256(message.slice(0, message.length - SignatureLength));
  }
  return keccak256(message);
}

function ecRecoverPubKey(
  messageHash: string,
  signature: Buffer
): Uint8Array | undefined {
  const recovery = signature.slice(64).readIntBE(0, 1);
  const _signature = secp.Signature.fromCompact(signature.slice(0, 64));

  return secp.recoverPublicKey(
    hexToBytes(messageHash),
    _signature,
    recovery,
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore: compressed: false
    false
  );
}

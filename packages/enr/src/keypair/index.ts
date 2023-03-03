import { unmarshalPrivateKey, unmarshalPublicKey } from "@libp2p/crypto/keys";
import { supportedKeys } from "@libp2p/crypto/keys";
import type { PeerId } from "@libp2p/interface-peer-id";
import { peerIdFromKeys } from "@libp2p/peer-id";

import { Secp256k1Keypair } from "./secp256k1.js";
import { IKeypair, KeypairType } from "./types.js";

export const ERR_TYPE_NOT_IMPLEMENTED = "Keypair type not implemented";
export * from "./types.js";
export * from "./secp256k1.js";

export function createPeerIdFromPublicKey(
  publicKey: Uint8Array
): Promise<PeerId> {
  const _publicKey = new supportedKeys.secp256k1.Secp256k1PublicKey(publicKey);
  return peerIdFromKeys(_publicKey.bytes, undefined);
}

export function createKeypair(
  type: KeypairType,
  privateKey?: Uint8Array,
  publicKey?: Uint8Array
): IKeypair {
  switch (type) {
    case KeypairType.secp256k1:
      return new Secp256k1Keypair(privateKey, publicKey);
    default:
      throw new Error(ERR_TYPE_NOT_IMPLEMENTED);
  }
}

export async function createKeypairFromPeerId(
  peerId: PeerId
): Promise<IKeypair> {
  let keypairType;
  switch (peerId.type) {
    case "RSA":
      keypairType = KeypairType.rsa;
      break;
    case "Ed25519":
      keypairType = KeypairType.ed25519;
      break;
    case "secp256k1":
      keypairType = KeypairType.secp256k1;
      break;
    default:
      throw new Error("Unsupported peer id type");
  }

  const publicKey = peerId.publicKey
    ? unmarshalPublicKey(peerId.publicKey)
    : undefined;
  const privateKey = peerId.privateKey
    ? await unmarshalPrivateKey(peerId.privateKey)
    : undefined;

  return createKeypair(
    keypairType,
    privateKey?.marshal(),
    publicKey?.marshal()
  );
}

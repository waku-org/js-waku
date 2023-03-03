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

export function getPublicKeyFromPeerId(peerId: PeerId): Uint8Array {
  if (peerId.type !== "secp256k1") {
    throw new Error("Unsupported peer id type");
  }

  return unmarshalPublicKey(peerId.publicKey).marshal();
}

// Only used in tests
export async function getPrivateKeyFromPeerId(
  peerId: PeerId
): Promise<Uint8Array> {
  if (peerId.type !== "secp256k1") {
    throw new Error("Unsupported peer id type");
  }
  if (!peerId.privateKey) {
    throw new Error("Private key not present on peer id");
  }

  const privateKey = await unmarshalPrivateKey(peerId.privateKey);
  return privateKey.marshal();
}

import { unmarshalPrivateKey, unmarshalPublicKey } from "@libp2p/crypto/keys";
import { supportedKeys } from "@libp2p/crypto/keys";
import type { PeerId } from "@libp2p/interface";
import { peerIdFromKeys } from "@libp2p/peer-id";

export function createPeerIdFromPublicKey(
  publicKey: Uint8Array
): Promise<PeerId> {
  const _publicKey = new supportedKeys.secp256k1.Secp256k1PublicKey(publicKey);
  return peerIdFromKeys(_publicKey.bytes, undefined);
}

export function getPublicKeyFromPeerId(peerId: PeerId): Uint8Array {
  if (peerId.type !== "secp256k1") {
    throw new Error("Unsupported peer id type");
  }

  if (!peerId.publicKey) {
    throw new Error("Public key not present on peer id");
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

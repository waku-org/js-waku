import { keys } from "libp2p-crypto";
import { identity } from "multiformats/hashes/identity";
import PeerId from "peer-id";

const { keysPBM, supportedKeys } = keys;

import { ERR_TYPE_NOT_IMPLEMENTED } from "./constants";
import { Secp256k1Keypair } from "./secp256k1";
import { IKeypair, KeypairType } from "./types";

export * from "./types";
export * from "./secp256k1";

export async function generateKeypair(type: KeypairType): Promise<IKeypair> {
  switch (type) {
    case KeypairType.secp256k1:
      return await Secp256k1Keypair.generate();
    default:
      throw new Error(ERR_TYPE_NOT_IMPLEMENTED);
  }
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

export async function createPeerIdFromKeypair(
  keypair: IKeypair
): Promise<PeerId> {
  switch (keypair.type) {
    case KeypairType.secp256k1: {
      // manually create a peer id to avoid expensive ops
      const privKey = keypair.hasPrivateKey()
        ? new supportedKeys.secp256k1.Secp256k1PrivateKey(
            keypair.privateKey,
            keypair.publicKey
          )
        : undefined;

      const pubKey = new supportedKeys.secp256k1.Secp256k1PublicKey(
        keypair.publicKey
      );
      const id = await identity.digest(pubKey.bytes);
      return new PeerId(id.bytes, privKey, pubKey);
    }
    default:
      throw new Error(ERR_TYPE_NOT_IMPLEMENTED);
  }
}

export function createKeypairFromPeerId(peerId: PeerId): IKeypair {
  // pub/private key bytes from peer-id are encoded in protobuf format
  const pub = keysPBM.PublicKey.decode(peerId.pubKey.bytes);
  return createKeypair(
    pub.Type as KeypairType,
    peerId.privKey ? peerId.privKey.marshal() : undefined,
    pub.Data
  );
}

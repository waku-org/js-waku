import type { PeerId } from "@libp2p/interface/peer-id";
import type { ENRKey, ENRValue } from "@waku/interfaces";
import { utf8ToBytes } from "@waku/utils/bytes";

import { compressPublicKey } from "../helpers/crypto.js";
import { getPublicKeyFromPeerId } from "../helpers/peer_id.js";

import { ENR } from "./enr.js";

export class EnrCreator {
  static fromPublicKey(
    publicKey: Uint8Array,
    kvs: Record<ENRKey, ENRValue> = {}
  ): Promise<ENR> {
    // EIP-778 specifies that the key must be in compressed format, 33 bytes
    if (publicKey.length !== 33) {
      publicKey = compressPublicKey(publicKey);
    }
    return ENR.create({
      ...kvs,
      id: utf8ToBytes("v4"),
      secp256k1: publicKey
    });
  }

  static async fromPeerId(
    peerId: PeerId,
    kvs: Record<ENRKey, ENRValue> = {}
  ): Promise<ENR> {
    switch (peerId.type) {
      case "secp256k1":
        return EnrCreator.fromPublicKey(getPublicKeyFromPeerId(peerId), kvs);
      default:
        throw new Error();
    }
  }
}

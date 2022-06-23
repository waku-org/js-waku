import { supportedKeys } from "@libp2p/crypto/keys";
import { peerIdFromKeys } from "@libp2p/peer-id";
import { expect } from "chai";

import {
  createPeerIdFromKeypair,
  generateKeypair,
  KeypairType,
  Secp256k1Keypair,
} from "./index";

describe("createPeerIdFromKeypair", function () {
  it("should properly create a PeerId from a secp256k1 keypair with private key", async function () {
    const keypair = await generateKeypair(KeypairType.secp256k1);

    const expectedPeerId = await peerIdFromKeys(
      keypair.publicKey,
      keypair.privateKey
    );
    const actualPeerId = await createPeerIdFromKeypair(keypair);

    expect(actualPeerId).to.be.deep.equal(expectedPeerId);
  });

  it("should properly create a PeerId from a secp256k1 keypair without private key", async function () {
    const keypair = await generateKeypair(KeypairType.secp256k1);
    delete (keypair as Secp256k1Keypair)._privateKey;
    const pubKey = new supportedKeys.secp256k1.Secp256k1PublicKey(
      keypair.publicKey
    );

    const expectedPeerId = await peerIdFromKeys(pubKey.bytes);
    const actualPeerId = await createPeerIdFromKeypair(keypair);

    expect(actualPeerId).to.be.deep.equal(expectedPeerId);
  });
});

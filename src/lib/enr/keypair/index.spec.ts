import { expect } from 'chai';
import { keys } from 'libp2p-crypto';
import PeerId from 'peer-id';

import {
  AbstractKeypair,
  createPeerIdFromKeypair,
  generateKeypair,
  KeypairType,
} from './index';

const { supportedKeys } = keys;

describe('createPeerIdFromKeypair', function () {
  it('should properly create a PeerId from a secp256k1 keypair with private key', async function () {
    const keypair = await generateKeypair(KeypairType.secp256k1);
    const privKey = new supportedKeys.secp256k1.Secp256k1PrivateKey(
      keypair.privateKey,
      keypair.publicKey
    );

    const expectedPeerId = await PeerId.createFromPrivKey(privKey.bytes);
    const actualPeerId = await createPeerIdFromKeypair(keypair);

    expect(actualPeerId).to.be.deep.equal(expectedPeerId);
  });

  it('should properly create a PeerId from a secp256k1 keypair without private key', async function () {
    const keypair = await generateKeypair(KeypairType.secp256k1);
    delete (keypair as AbstractKeypair)._privateKey;
    const pubKey = new supportedKeys.secp256k1.Secp256k1PublicKey(
      keypair.publicKey
    );

    const expectedPeerId = await PeerId.createFromPubKey(pubKey.bytes);
    const actualPeerId = await createPeerIdFromKeypair(keypair);

    expect(actualPeerId).to.be.deep.equal(expectedPeerId);
  });
});

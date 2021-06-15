import 'react-native-get-random-values';

import '@ethersproject/shims';

import * as EthCrypto from 'eth-crypto';
import { toUtf8Bytes } from '@ethersproject/strings';
import { ethers } from 'ethers';
import { Signer } from '@ethersproject/abstract-signer';
import { PublicKeyMessage } from './messages';

const Salt =
  'Salt for Eth-Dm, do not share a signature of this message or others could decrypt your messages';

export interface KeyPair {
  privateKey: string;
  publicKey: string;
  address: string;
}

/**
 * Use the signature of the Salt ("Salt for eth-dm...") as
 * the entropy for the EthCrypto keypair. Note that the entropy is hashed with keccak256
 * to make the private key.
 */
export async function generateEthDmKeyPair(
  web3Signer: Signer
): Promise<KeyPair> {
  const signature = await web3Signer.signMessage(Salt);
  const entropy = Buffer.from(toUtf8Bytes(signature));
  const keys = EthCrypto.createIdentity(entropy);
  return keys;
}

/**
 * Sign the Eth-DM public key with Web3. This can then be published to let other
 * users know to use this Eth-DM public key to encrypt messages destinated to the
 * Web3 account holder (ie, Ethereum Address holder).
 */
export async function createPublicKeyMessage(
  web3Signer: Signer,
  ethDmPublicKey: string
): Promise<PublicKeyMessage> {
  const ethAddress = await web3Signer.getAddress();
  const sig = await web3Signer.signMessage(
    formatPublicKeyForSignature(ethDmPublicKey)
  );
  return { ethDmPublicKey, ethAddress, sig };
}

/**
 * Validate that the EthDm Public Key was signed by the holder of the given Ethereum address.
 */
export function validatePublicKeyMessage(msg: PublicKeyMessage): boolean {
  try {
    const sigAddress = ethers.utils.verifyMessage(
      formatPublicKeyForSignature(msg.ethDmPublicKey),
      msg.sig
    );
    return sigAddress === msg.ethAddress;
  } catch (e) {
    return false;
  }
}

/**
 * Prepare Eth-Dm Public key to be signed for publication.
 * The public key is set in on Object `{ ethDmPublicKey: string; }`, converted
 * to JSON and then hashed with Keccak256.
 * The usage of the object helps ensure the signature is only used in an Eth-DM
 * context.
 */
function formatPublicKeyForSignature(ethDmPublicKey: string): string {
  const txt = JSON.stringify({
    ethDmPublicKey,
  });
  return txt;
}

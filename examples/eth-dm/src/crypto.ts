import '@ethersproject/shims';

import { ethers } from 'ethers';
import { Signer } from '@ethersproject/abstract-signer';
import { PublicKeyMessage } from './messaging/wire';
import { hexToBuf, equalByteArrays, bufToHex } from 'js-waku/lib/utils';
import { generatePrivateKey, getPublicKey } from 'js-waku';

export interface KeyPair {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
}

/**
 * Use the signature of the Salt ("Salt for eth-dm...") as
 * the entropy for the EthCrypto keypair. Note that the entropy is hashed with keccak256
 * to make the private key.
 */
export async function generateEncryptionKeyPair(): Promise<KeyPair> {
  const privateKey = generatePrivateKey();
  const publicKey = getPublicKey(privateKey);
  return { privateKey, publicKey };
}

/**
 * Sign the Eth-DM public key with Web3. This can then be published to let other
 * users know to use this Eth-DM public key to encrypt messages for the
 * Ethereum Address holder.
 */
export async function createPublicKeyMessage(
  web3Signer: Signer,
  encryptionPublicKey: Uint8Array
): Promise<PublicKeyMessage> {
  const ethAddress = await web3Signer.getAddress();
  const signature = await web3Signer.signMessage(
    formatPublicKeyForSignature(encryptionPublicKey)
  );

  return new PublicKeyMessage({
    encryptionPublicKey: encryptionPublicKey,
    ethAddress: hexToBuf(ethAddress),
    signature: hexToBuf(signature),
  });
}

/**
 * Validate that the Encryption Public Key was signed by the holder of the given Ethereum address.
 */
export function validatePublicKeyMessage(msg: PublicKeyMessage): boolean {
  const formattedMsg = formatPublicKeyForSignature(msg.encryptionPublicKey);
  try {
    const sigAddress = ethers.utils.verifyMessage(formattedMsg, msg.signature);
    return equalByteArrays(sigAddress, msg.ethAddress);
  } catch (e) {
    console.log(
      'Failed to verify signature for Public Key Message',
      formattedMsg,
      msg
    );
    return false;
  }
}

/**
 * Prepare Eth-Dm Public key to be signed for publication.
 * The public key is set in on Object `{ encryptionPublicKey: string; }`, converted
 * to JSON and then hashed with Keccak256.
 * The usage of the object helps ensure the signature is only used in an Eth-DM
 * context.
 */
function formatPublicKeyForSignature(encryptionPublicKey: Uint8Array): string {
  return JSON.stringify({
    encryptionPublicKey: bufToHex(encryptionPublicKey),
  });
}

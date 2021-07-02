import '@ethersproject/shims';

import * as EthCrypto from 'eth-crypto';
import { ethers } from 'ethers';
import { Signer } from '@ethersproject/abstract-signer';
import { DirectMessage, PublicKeyMessage } from './messaging/wire';
import { byteArrayToHex, hexToBuf } from './utils';

export interface KeyPair {
  privateKey: string;
  publicKey: string;
}

/**
 * Use the signature of the Salt ("Salt for eth-dm...") as
 * the entropy for the EthCrypto keypair. Note that the entropy is hashed with keccak256
 * to make the private key.
 */
export async function generateEthDmKeyPair(): Promise<KeyPair> {
  return EthCrypto.createIdentity();
}

/**
 * Sign the Eth-DM public key with Web3. This can then be published to let other
 * users know to use this Eth-DM public key to encrypt messages for the
 * Ethereum Address holder.
 */
export async function createPublicKeyMessage(
  web3Signer: Signer,
  ethDmPublicKey: string
): Promise<PublicKeyMessage> {
  const ethAddress = await web3Signer.getAddress();
  const bytesEthDmPublicKey = hexToBuf(ethDmPublicKey);
  const signature = await web3Signer.signMessage(
    formatPublicKeyForSignature(bytesEthDmPublicKey)
  );

  return new PublicKeyMessage({
    ethDmPublicKey: bytesEthDmPublicKey,
    ethAddress: hexToBuf(ethAddress),
    signature: hexToBuf(signature),
  });
}

/**
 * Validate that the EthDm Public Key was signed by the holder of the given Ethereum address.
 */
export function validatePublicKeyMessage(msg: PublicKeyMessage): boolean {
  const formattedMsg = formatPublicKeyForSignature(msg.ethDmPublicKey);
  try {
    const sigAddress = ethers.utils.verifyMessage(formattedMsg, msg.signature);
    const sigAddressBytes = hexToBuf(sigAddress);
    // Compare the actual byte arrays instead of strings that may differ in casing or prefixing.
    const cmp = sigAddressBytes.compare(new Buffer(msg.ethAddress));
    console.log(
      `Buffer comparison result: ${cmp} for (signature address, message address)`,
      sigAddressBytes,
      msg.ethAddress
    );
    return cmp === 0;
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
 * The public key is set in on Object `{ ethDmPublicKey: string; }`, converted
 * to JSON and then hashed with Keccak256.
 * The usage of the object helps ensure the signature is only used in an Eth-DM
 * context.
 */
function formatPublicKeyForSignature(ethDmPublicKey: Uint8Array): string {
  return JSON.stringify({
    ethDmPublicKey: byteArrayToHex(ethDmPublicKey),
  });
}

/**
 * Decrypt a Direct Message using the private key.
 */
export function decryptMessage(
  privateKey: string,
  directMessage: DirectMessage
) {
  return EthCrypto.decryptWithPrivateKey(privateKey, directMessage.encMessage);
}

/**
 * Encrypt message with given Public Key
 */
export async function encryptMessage(publicKey: string, message: string) {
  return await EthCrypto.encryptWithPublicKey(publicKey, message);
}

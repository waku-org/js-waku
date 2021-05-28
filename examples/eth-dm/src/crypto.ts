import * as EthCrypto from 'eth-crypto';
import { toUtf8Bytes } from '@ethersproject/strings';
import { ethers } from 'ethers';
import { Signer } from '@ethersproject/abstract-signer';

const Salt = EthCrypto.hash.keccak256("Salt for Eth-Dm, do not share a signature of this message or other could decrypt your messages");

/**
 * Use the signature of the Salt (keccak256 hash of the sentence "Salt for eth-dm..." as
 * the entropy for the EthCrypto keypair. Note that the entropy is hashed with keccak256
 * to make the private key.
 */
export async function generateEthDmKeyPair(web3Signer: Signer) {
  const signature = await web3Signer.signMessage(Salt)
  const entropy = Buffer.from(toUtf8Bytes(signature));
  const keys = EthCrypto.createIdentity(entropy);
  return keys;
}

/**
 * Message used to communicate the Eth-Dm public key linked to a given Ethereum account
 */
export interface EthDmPublicationMessage {
  ethDmPublicKey: string;
  ethAddress: string;
  sig: string;
}

/**
 * Sign the Eth-DM public key with Web3. This can then be published to let other
 * users know to use this Eth-DM public key to encrypt messages destinated to the
 * Web3 account holder (ie, Ethereum Address holder).
 */
export async function createEthDmPublicationMessage(web3Signer: Signer, ethDmPublicKey: string): Promise<EthDmPublicationMessage> {
  const ethAddress = await web3Signer.getAddress();
  const sig = await web3Signer.signMessage(formatEthDmPublicKeyForSig(ethDmPublicKey))
  return { ethDmPublicKey, ethAddress, sig };
}

/**
 * Verifies that the EthDm Public Key was signed by the holder of the given Ethereum address.
 */
export function verifyEthDmPublicKey(msg: EthDmPublicationMessage): boolean {
  try {
    const sigAddress = ethers.utils.verifyMessage(formatEthDmPublicKeyForSig(msg.ethDmPublicKey), msg.sig);
    return sigAddress == msg.ethAddress;
  }
  catch (e) {
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
function formatEthDmPublicKeyForSig(ethDmPublicKey: string): string {
  return EthCrypto.hash.keccak256(JSON.stringify({
    ethDmPublicKey
  }))
}

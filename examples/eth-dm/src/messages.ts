import * as EthCrypto from 'eth-crypto';

/**
 * Message used to communicate the Eth-Dm public key linked to a given Ethereum account
 */
export interface PublicKeyMessage {
  ethDmPublicKey: string;
  ethAddress: string;
  sig: string;
}

/**
 * Direct Encrypted Message used for private communication over the Waku network.
 */
export interface DirectMessage {
  toAddress: string;
  encMessage: EthCrypto.Encrypted;
}

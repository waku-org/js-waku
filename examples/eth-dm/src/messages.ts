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

export function encode<T>(msg: T): Buffer {
  const jsonStr = JSON.stringify(msg);
  return Buffer.from(jsonStr, 'utf-8');
}

export function decode<T>(bytes: Uint8Array): T {
  const buf = Buffer.from(bytes);
  const str = buf.toString('utf-8');
  return JSON.parse(str);
}

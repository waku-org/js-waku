import type { IdentityCredential } from "../identity.js";

export type MembershipHash = string;
export type Sha256Hash = string;
export type Keccak256Hash = string;
export type Password = string | Uint8Array;

// see reference
// https://github.com/waku-org/nwaku/blob/f05528d4be3d3c876a8b07f9bb7dfaae8aa8ec6e/waku/waku_keystore/protocol_types.nim#L111
export type KeystoreMembershipInfo = {
  chainId: string;
  address: string;
  treeIndex: number;
  rateLimit: number;
};

export type KeystoreEntity = {
  identity: IdentityCredential;
  membership: KeystoreMembershipInfo;
};

export type DecryptedCredentials = KeystoreEntity;

export type EncryptedCredentials = {
  /**
   * Valid JSON string that contains Keystore
   */
  keystore: string;
  /**
   * ID of credentials from provided Keystore to use
   */
  id: string;
  /**
   * Password to decrypt credentials provided
   */
  password: Password;
};

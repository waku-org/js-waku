import { RLNDecoder, RLNEncoder } from "./codec.js";
import { RLN_ABI } from "./contract/abi.js";
import { LINEA_CONTRACT, RLNContract } from "./contract/index.js";
import { RLNBaseContract } from "./contract/rln_base_contract.js";
import { createRLN } from "./create.js";
import { RLNCredentialsManager } from "./credentials_manager.js";
import { IdentityCredential } from "./identity.js";
import { Keystore } from "./keystore/index.js";
import { Proof } from "./proof.js";
import { RLNInstance } from "./rln.js";
import { MerkleRootTracker } from "./root_tracker.js";
import { extractMetaMaskSigner } from "./utils/index.js";

export {
  RLNCredentialsManager,
  RLNBaseContract,
  createRLN,
  Keystore,
  RLNInstance,
  IdentityCredential,
  Proof,
  RLNEncoder,
  RLNDecoder,
  MerkleRootTracker,
  RLNContract,
  LINEA_CONTRACT,
  extractMetaMaskSigner,
  RLN_ABI
};

export type {
  DecryptedCredentials,
  EncryptedCredentials,
  Keccak256Hash,
  KeystoreEntity,
  MembershipHash,
  MembershipInfo,
  Password,
  Sha256Hash
} from "./keystore/types.js";

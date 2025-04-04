import { ethers } from "ethers";

import { IdentityCredential } from "./identity.js";
import {
  DecryptedCredentials,
  EncryptedCredentials
} from "./keystore/types.js";

export type StartRLNOptions = {
  /**
   * If not set - will extract MetaMask account and get signer from it.
   */
  signer?: ethers.Signer;
  /**
   * If not set - will use default SEPOLIA_CONTRACT address.
   */
  address?: string;
  /**
   * Credentials to use for generating proofs and connecting to the contract and network.
   * If provided used for validating the network chainId and connecting to registry contract.
   */
  credentials?: EncryptedCredentials | DecryptedCredentials;
  /**
   * Rate limit for the member.
   */
  rateLimit?: number;
};

export type RegisterMembershipOptions =
  | { signature: string }
  | { identity: IdentityCredential };

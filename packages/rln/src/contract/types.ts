import { ethers } from "ethers";

export interface MembershipRegisteredEvent {
  idCommitment: string;
  rateLimit: number;
  index: ethers.BigNumber;
}

export interface Member {
  idCommitment: string;
  index: ethers.BigNumber;
}

interface RLNContractOptions {
  signer: ethers.Signer;
  address: string;
  rateLimit?: number;
}

export interface FetchMembersOptions {
  fromBlock?: number;
  fetchRange?: number;
  fetchChunks?: number;
}

export interface RLNContractInitOptions extends RLNContractOptions {
  contract?: ethers.Contract;
}

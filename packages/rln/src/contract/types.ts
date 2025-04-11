import { ethers } from "ethers";

export interface CustomQueryOptions extends FetchMembersOptions {
  membersFilter: ethers.EventFilter;
}

export type Member = {
  idCommitment: string;
  index: ethers.BigNumber;
};

export interface RLNContractOptions {
  signer: ethers.Signer;
  address: string;
  rateLimit?: number;
}

export interface RLNContractInitOptions extends RLNContractOptions {
  contract?: ethers.Contract;
}

export interface MembershipRegisteredEvent {
  idCommitment: string;
  membershipRateLimit: ethers.BigNumber;
  index: ethers.BigNumber;
}

export type FetchMembersOptions = {
  fromBlock?: number;
  fetchRange?: number;
  fetchChunks?: number;
};

export interface MembershipInfo {
  index: ethers.BigNumber;
  idCommitment: string;
  rateLimit: number;
  startBlock: number;
  endBlock: number;
  state: MembershipState;
}

export enum MembershipState {
  Active = "Active",
  GracePeriod = "GracePeriod",
  Expired = "Expired",
  ErasedAwaitsWithdrawal = "ErasedAwaitsWithdrawal"
}

import { Logger } from "@waku/utils";
import { hexToBytes } from "@waku/utils/bytes";
import { ethers } from "ethers";

import type { IdentityCredential } from "../identity.js";
import type { DecryptedCredentials } from "../keystore/index.js";
import type { RLNInstance } from "../rln.js";
import { MerkleRootTracker } from "../root_tracker.js";
import { zeroPadLE } from "../utils/bytes.js";

import { RLN_ABI } from "./abi.js";
import { DEFAULT_RATE_LIMIT, RATE_LIMIT_PARAMS } from "./constants.js";

const log = new Logger("waku:rln:contract");

type Member = {
  idCommitment: string;
  index: ethers.BigNumber;
};

interface RLNContractOptions {
  signer: ethers.Signer;
  address: string;
  rateLimit?: number;
}

interface RLNContractInitOptions extends RLNContractOptions {
  contract?: ethers.Contract;
}

export interface MembershipRegisteredEvent {
  idCommitment: string;
  rateLimit: number;
  index: ethers.BigNumber;
}

type FetchMembersOptions = {
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

export class RLNContract {
  public contract: ethers.Contract;
  private merkleRootTracker: MerkleRootTracker;

  private deployBlock: undefined | number;
  private rateLimit: number;

  private _members: Map<number, Member> = new Map();
  private _membersFilter: ethers.EventFilter;
  private _membersRemovedFilter: ethers.EventFilter;

  /**
   * Asynchronous initializer for RLNContract.
   * Allows injecting a mocked contract for testing purposes.
   */
  public static async init(
    rlnInstance: RLNInstance,
    options: RLNContractInitOptions
  ): Promise<RLNContract> {
    const rlnContract = new RLNContract(rlnInstance, options);

    await rlnContract.fetchMembers(rlnInstance);
    rlnContract.subscribeToMembers(rlnInstance);

    return rlnContract;
  }

  private constructor(
    rlnInstance: RLNInstance,
    options: RLNContractInitOptions
  ) {
    const {
      address,
      signer,
      rateLimit = DEFAULT_RATE_LIMIT,
      contract
    } = options;

    if (
      rateLimit < RATE_LIMIT_PARAMS.MIN_RATE ||
      rateLimit > RATE_LIMIT_PARAMS.MAX_RATE
    ) {
      throw new Error(
        `Rate limit must be between ${RATE_LIMIT_PARAMS.MIN_RATE} and ${RATE_LIMIT_PARAMS.MAX_RATE} messages per epoch`
      );
    }

    this.rateLimit = rateLimit;

    const initialRoot = rlnInstance.zerokit.getMerkleRoot();

    // Use the injected contract if provided; otherwise, instantiate a new one.
    this.contract = contract || new ethers.Contract(address, RLN_ABI, signer);
    this.merkleRootTracker = new MerkleRootTracker(5, initialRoot);

    // Initialize event filters for MembershipRegistered and MembershipRemoved
    this._membersFilter = this.contract.filters.MembershipRegistered();
    this._membersRemovedFilter = this.contract.filters.MembershipRemoved();
  }

  /**
   * Gets the current rate limit for this contract instance
   */
  public getRateLimit(): number {
    return this.rateLimit;
  }

  /**
   * Gets the contract address
   */
  public get address(): string {
    return this.contract.address;
  }

  /**
   * Gets the contract provider
   */
  public get provider(): ethers.providers.Provider {
    return this.contract.provider;
  }

  /**
   * Gets the minimum allowed rate limit from the contract
   * @returns Promise<number> The minimum rate limit in messages per epoch
   */
  public async getMinRateLimit(): Promise<number> {
    const minRate = await this.contract.minMembershipRateLimit();
    return minRate.toNumber();
  }

  /**
   * Gets the maximum allowed rate limit from the contract
   * @returns Promise<number> The maximum rate limit in messages per epoch
   */
  public async getMaxRateLimit(): Promise<number> {
    const maxRate = await this.contract.maxMembershipRateLimit();
    return maxRate.toNumber();
  }

  /**
   * Gets the maximum total rate limit across all memberships
   * @returns Promise<number> The maximum total rate limit in messages per epoch
   */
  public async getMaxTotalRateLimit(): Promise<number> {
    const maxTotalRate = await this.contract.maxTotalRateLimit();
    return maxTotalRate.toNumber();
  }

  /**
   * Gets the current total rate limit usage across all memberships
   * @returns Promise<number> The current total rate limit usage in messages per epoch
   */
  public async getCurrentTotalRateLimit(): Promise<number> {
    const currentTotal = await this.contract.currentTotalRateLimit();
    return currentTotal.toNumber();
  }

  /**
   * Gets the remaining available total rate limit that can be allocated
   * @returns Promise<number> The remaining rate limit that can be allocated
   */
  public async getRemainingTotalRateLimit(): Promise<number> {
    const [maxTotal, currentTotal] = await Promise.all([
      this.contract.maxTotalRateLimit(),
      this.contract.currentTotalRateLimit()
    ]);
    return maxTotal.sub(currentTotal).toNumber();
  }

  /**
   * Updates the rate limit for future registrations
   * @param newRateLimit The new rate limit to use
   */
  public async setRateLimit(newRateLimit: number): Promise<void> {
    this.rateLimit = newRateLimit;
  }

  public get members(): Member[] {
    const sortedMembers = Array.from(this._members.values()).sort(
      (left, right) => left.index.toNumber() - right.index.toNumber()
    );
    return sortedMembers;
  }

  private get membersFilter(): ethers.EventFilter {
    if (!this._membersFilter) {
      throw Error("Members filter was not initialized.");
    }
    return this._membersFilter;
  }

  private get membersRemovedFilter(): ethers.EventFilter {
    if (!this._membersRemovedFilter) {
      throw Error("MembersRemoved filter was not initialized.");
    }
    return this._membersRemovedFilter;
  }

  public async fetchMembers(
    rlnInstance: RLNInstance,
    options: FetchMembersOptions = {}
  ): Promise<void> {
    const registeredMemberEvents = await queryFilter(this.contract, {
      fromBlock: this.deployBlock,
      ...options,
      membersFilter: this.membersFilter
    });
    const removedMemberEvents = await queryFilter(this.contract, {
      fromBlock: this.deployBlock,
      ...options,
      membersFilter: this.membersRemovedFilter
    });

    const events = [...registeredMemberEvents, ...removedMemberEvents];
    this.processEvents(rlnInstance, events);
  }

  public processEvents(rlnInstance: RLNInstance, events: ethers.Event[]): void {
    const toRemoveTable = new Map<number, number[]>();
    const toInsertTable = new Map<number, ethers.Event[]>();

    events.forEach((evt) => {
      if (!evt.args) {
        return;
      }

      if (evt.event === "MembershipRemoved") {
        const index = evt.args.index as ethers.BigNumber;
        const toRemoveVal = toRemoveTable.get(evt.blockNumber);
        if (toRemoveVal != undefined) {
          toRemoveVal.push(index.toNumber());
          toRemoveTable.set(evt.blockNumber, toRemoveVal);
        } else {
          toRemoveTable.set(evt.blockNumber, [index.toNumber()]);
        }
      } else if (evt.event === "MembershipRegistered") {
        let eventsPerBlock = toInsertTable.get(evt.blockNumber);
        if (eventsPerBlock == undefined) {
          eventsPerBlock = [];
        }

        eventsPerBlock.push(evt);
        toInsertTable.set(evt.blockNumber, eventsPerBlock);
      }
    });

    this.removeMembers(rlnInstance, toRemoveTable);
    this.insertMembers(rlnInstance, toInsertTable);
  }

  private insertMembers(
    rlnInstance: RLNInstance,
    toInsert: Map<number, ethers.Event[]>
  ): void {
    toInsert.forEach((events: ethers.Event[], blockNumber: number) => {
      events.forEach((evt) => {
        if (!evt.args) return;

        const _idCommitment = evt.args.idCommitment as string;
        const index = evt.args.index as ethers.BigNumber;

        if (!_idCommitment || !index) {
          return;
        }

        const idCommitment = zeroPadLE(hexToBytes(_idCommitment), 32);
        rlnInstance.zerokit.insertMember(idCommitment);
        this._members.set(index.toNumber(), {
          index,
          idCommitment: _idCommitment
        });
      });

      const currentRoot = rlnInstance.zerokit.getMerkleRoot();
      this.merkleRootTracker.pushRoot(blockNumber, currentRoot);
    });
  }

  private removeMembers(
    rlnInstance: RLNInstance,
    toRemove: Map<number, number[]>
  ): void {
    const removeDescending = new Map([...toRemove].reverse());
    removeDescending.forEach((indexes: number[], blockNumber: number) => {
      indexes.forEach((index) => {
        if (this._members.has(index)) {
          this._members.delete(index);
          rlnInstance.zerokit.deleteMember(index);
        }
      });

      this.merkleRootTracker.backFill(blockNumber);
    });
  }

  public subscribeToMembers(rlnInstance: RLNInstance): void {
    this.contract.on(
      this.membersFilter,
      (
        _idCommitment: string,
        _rateLimit: number,
        _index: ethers.BigNumber,
        event: ethers.Event
      ) => {
        this.processEvents(rlnInstance, [event]);
      }
    );

    this.contract.on(
      this.membersRemovedFilter,
      (
        _idCommitment: string,
        _index: ethers.BigNumber,
        event: ethers.Event
      ) => {
        this.processEvents(rlnInstance, [event]);
      }
    );
  }

  public async registerWithIdentity(
    identity: IdentityCredential
  ): Promise<DecryptedCredentials | undefined> {
    try {
      log.info(
        `Registering identity with rate limit: ${this.rateLimit} messages/epoch`
      );

      const txRegisterResponse: ethers.ContractTransaction =
        await this.contract.register(
          identity.IDCommitmentBigInt,
          this.rateLimit,
          [],
          { gasLimit: 300000 }
        );
      const txRegisterReceipt = await txRegisterResponse.wait();

      const memberRegistered = txRegisterReceipt.events?.find(
        (event) => event.event === "MembershipRegistered"
      );

      if (!memberRegistered || !memberRegistered.args) {
        log.error(
          "Failed to register membership: No MembershipRegistered event found"
        );
        return undefined;
      }

      const decodedData: MembershipRegisteredEvent = {
        idCommitment: memberRegistered.args.idCommitment,
        rateLimit: memberRegistered.args.rateLimit,
        index: memberRegistered.args.index
      };

      log.info(
        `Successfully registered membership with index ${decodedData.index} ` +
          `and rate limit ${decodedData.rateLimit}`
      );

      const network = await this.contract.provider.getNetwork();
      const address = this.contract.address;
      const membershipId = decodedData.index.toNumber();

      return {
        identity,
        membership: {
          address,
          treeIndex: membershipId,
          chainId: network.chainId
        }
      };
    } catch (error) {
      log.error(`Error in registerWithIdentity: ${(error as Error).message}`);
      return undefined;
    }
  }

  /**
   * Helper method to get remaining messages in current epoch
   * @param membershipId The ID of the membership to check
   * @returns number of remaining messages allowed in current epoch
   */
  public async getRemainingMessages(membershipId: number): Promise<number> {
    try {
      const [startTime, , rateLimit] =
        await this.contract.getMembershipInfo(membershipId);

      // Calculate current epoch
      const currentTime = Math.floor(Date.now() / 1000);
      const epochsPassed = Math.floor(
        (currentTime - startTime) / RATE_LIMIT_PARAMS.EPOCH_LENGTH
      );
      const currentEpochStart =
        startTime + epochsPassed * RATE_LIMIT_PARAMS.EPOCH_LENGTH;

      // Get message count in current epoch using contract's function
      const messageCount = await this.contract.getMessageCount(
        membershipId,
        currentEpochStart
      );
      return Math.max(0, rateLimit.sub(messageCount).toNumber());
    } catch (error) {
      log.error(
        `Error getting remaining messages: ${(error as Error).message}`
      );
      return 0; // Fail safe: assume no messages remaining on error
    }
  }

  public async registerWithPermitAndErase(
    identity: IdentityCredential,
    permit: {
      owner: string;
      deadline: number;
      v: number;
      r: string;
      s: string;
    },
    idCommitmentsToErase: string[]
  ): Promise<DecryptedCredentials | undefined> {
    try {
      log.info(
        `Registering identity with permit and rate limit: ${this.rateLimit} messages/epoch`
      );

      const txRegisterResponse: ethers.ContractTransaction =
        await this.contract.registerWithPermit(
          permit.owner,
          permit.deadline,
          permit.v,
          permit.r,
          permit.s,
          identity.IDCommitmentBigInt,
          this.rateLimit,
          idCommitmentsToErase.map((id) => ethers.BigNumber.from(id))
        );
      const txRegisterReceipt = await txRegisterResponse.wait();

      const memberRegistered = txRegisterReceipt.events?.find(
        (event) => event.event === "MembershipRegistered"
      );

      if (!memberRegistered || !memberRegistered.args) {
        log.error(
          "Failed to register membership with permit: No MembershipRegistered event found"
        );
        return undefined;
      }

      const decodedData: MembershipRegisteredEvent = {
        idCommitment: memberRegistered.args.idCommitment,
        rateLimit: memberRegistered.args.rateLimit,
        index: memberRegistered.args.index
      };

      log.info(
        `Successfully registered membership with permit. Index: ${decodedData.index}, ` +
          `Rate limit: ${decodedData.rateLimit}, Erased ${idCommitmentsToErase.length} commitments`
      );

      const network = await this.contract.provider.getNetwork();
      const address = this.contract.address;
      const membershipId = decodedData.index.toNumber();

      return {
        identity,
        membership: {
          address,
          treeIndex: membershipId,
          chainId: network.chainId
        }
      };
    } catch (error) {
      log.error(
        `Error in registerWithPermitAndErase: ${(error as Error).message}`
      );
      return undefined;
    }
  }

  public roots(): Uint8Array[] {
    return this.merkleRootTracker.roots();
  }

  public async withdraw(token: string, holder: string): Promise<void> {
    try {
      const tx = await this.contract.withdraw(token, { from: holder });
      await tx.wait();
    } catch (error) {
      log.error(`Error in withdraw: ${(error as Error).message}`);
    }
  }

  public async getMembershipInfo(
    idCommitment: string
  ): Promise<MembershipInfo | undefined> {
    try {
      const [startBlock, endBlock, rateLimit] =
        await this.contract.getMembershipInfo(idCommitment);
      const currentBlock = await this.contract.provider.getBlockNumber();

      let state: MembershipState;
      if (currentBlock < startBlock) {
        state = MembershipState.Active;
      } else if (currentBlock < endBlock) {
        state = MembershipState.GracePeriod;
      } else {
        state = MembershipState.Expired;
      }

      const index = await this.getMemberIndex(idCommitment);
      if (!index) return undefined;

      return {
        index,
        idCommitment,
        rateLimit: rateLimit.toNumber(),
        startBlock: startBlock.toNumber(),
        endBlock: endBlock.toNumber(),
        state
      };
    } catch (error) {
      return undefined;
    }
  }

  public async extendMembership(
    idCommitment: string
  ): Promise<ethers.ContractTransaction> {
    return this.contract.extendMemberships([idCommitment]);
  }

  public async eraseMembership(
    idCommitment: string,
    eraseFromMembershipSet: boolean = true
  ): Promise<ethers.ContractTransaction> {
    return this.contract.eraseMemberships(
      [idCommitment],
      eraseFromMembershipSet
    );
  }

  public async registerMembership(
    idCommitment: string,
    rateLimit: number = DEFAULT_RATE_LIMIT
  ): Promise<ethers.ContractTransaction> {
    if (
      rateLimit < RATE_LIMIT_PARAMS.MIN_RATE ||
      rateLimit > RATE_LIMIT_PARAMS.MAX_RATE
    ) {
      throw new Error(
        `Rate limit must be between ${RATE_LIMIT_PARAMS.MIN_RATE} and ${RATE_LIMIT_PARAMS.MAX_RATE}`
      );
    }
    return this.contract.register(idCommitment, rateLimit, []);
  }

  private async getMemberIndex(
    idCommitment: string
  ): Promise<ethers.BigNumber | undefined> {
    try {
      const events = await this.contract.queryFilter(
        this.contract.filters.MembershipRegistered(idCommitment)
      );
      if (events.length === 0) return undefined;

      // Get the most recent registration event
      const event = events[events.length - 1];
      return event.args?.index;
    } catch (error) {
      return undefined;
    }
  }
}

interface CustomQueryOptions extends FetchMembersOptions {
  membersFilter: ethers.EventFilter;
}

// These values should be tested on other networks
const FETCH_CHUNK = 5;
const BLOCK_RANGE = 3000;

async function queryFilter(
  contract: ethers.Contract,
  options: CustomQueryOptions
): Promise<ethers.Event[]> {
  const {
    fromBlock,
    membersFilter,
    fetchRange = BLOCK_RANGE,
    fetchChunks = FETCH_CHUNK
  } = options;

  if (fromBlock === undefined) {
    return contract.queryFilter(membersFilter);
  }

  if (!contract.provider) {
    throw Error("No provider found on the contract.");
  }

  const toBlock = await contract.provider.getBlockNumber();

  if (toBlock - fromBlock < fetchRange) {
    return contract.queryFilter(membersFilter, fromBlock, toBlock);
  }

  const events: ethers.Event[][] = [];
  const chunks = splitToChunks(fromBlock, toBlock, fetchRange);

  for (const portion of takeN<[number, number]>(chunks, fetchChunks)) {
    const promises = portion.map(([left, right]) =>
      ignoreErrors(contract.queryFilter(membersFilter, left, right), [])
    );
    const fetchedEvents = await Promise.all(promises);
    events.push(fetchedEvents.flatMap((v) => v));
  }

  return events.flatMap((v) => v);
}

function splitToChunks(
  from: number,
  to: number,
  step: number
): Array<[number, number]> {
  const chunks: Array<[number, number]> = [];

  let left = from;
  while (left < to) {
    const right = left + step < to ? left + step : to;

    chunks.push([left, right] as [number, number]);

    left = right;
  }

  return chunks;
}

function* takeN<T>(array: T[], size: number): Iterable<T[]> {
  let start = 0;

  while (start < array.length) {
    const portion = array.slice(start, start + size);

    yield portion;

    start += size;
  }
}

async function ignoreErrors<T>(
  promise: Promise<T>,
  defaultValue: T
): Promise<T> {
  try {
    return await promise;
  } catch (err: unknown) {
    if (err instanceof Error) {
      log.info(`Ignoring an error during query: ${err.message}`);
    } else {
      log.info(`Ignoring an unknown error during query`);
    }
    return defaultValue;
  }
}

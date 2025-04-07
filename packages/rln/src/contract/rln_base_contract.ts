import { Logger } from "@waku/utils";
import { ethers } from "ethers";

import { IdentityCredential } from "../identity.js";
import { DecryptedCredentials } from "../keystore/types.js";

import { RLN_ABI } from "./abi.js";
import { DEFAULT_RATE_LIMIT, RATE_LIMIT_PARAMS } from "./constants.js";
import {
  CustomQueryOptions,
  FetchMembersOptions,
  Member,
  MembershipInfo,
  MembershipRegisteredEvent,
  MembershipState,
  RLNContractInitOptions
} from "./types.js";

const log = new Logger("waku:rln:contract:base");

export class RLNBaseContract {
  public contract: ethers.Contract;
  private deployBlock: undefined | number;
  private rateLimit: number;

  protected _members: Map<number, Member> = new Map();
  private _membersFilter: ethers.EventFilter;
  private _membershipErasedFilter: ethers.EventFilter;
  private _membersExpiredFilter: ethers.EventFilter;

  /**
   * Constructor for RLNBaseContract.
   * Allows injecting a mocked contract for testing purposes.
   */
  public constructor(options: RLNContractInitOptions) {
    // Initialize members and subscriptions
    this.fetchMembers()
      .then(() => {
        this.subscribeToMembers();
      })
      .catch((error) => {
        log.error("Failed to initialize members", { error });
      });

    const {
      address,
      signer,
      rateLimit = DEFAULT_RATE_LIMIT,
      contract
    } = options;

    this.validateRateLimit(rateLimit);

    this.contract = contract || new ethers.Contract(address, RLN_ABI, signer);
    this.rateLimit = rateLimit;

    // Initialize event filters
    this._membersFilter = this.contract.filters.MembershipRegistered();
    this._membershipErasedFilter = this.contract.filters.MembershipErased();
    this._membersExpiredFilter = this.contract.filters.MembershipExpired();
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
    return ethers.BigNumber.from(minRate).toNumber();
  }

  /**
   * Gets the maximum allowed rate limit from the contract
   * @returns Promise<number> The maximum rate limit in messages per epoch
   */
  public async getMaxRateLimit(): Promise<number> {
    const maxRate = await this.contract.maxMembershipRateLimit();
    return ethers.BigNumber.from(maxRate).toNumber();
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
    return Number(maxTotal) - Number(currentTotal);
  }

  /**
   * Updates the rate limit for future registrations
   * @param newRateLimit The new rate limit to use
   */
  public async setRateLimit(newRateLimit: number): Promise<void> {
    this.validateRateLimit(newRateLimit);
    this.rateLimit = newRateLimit;
  }

  public get members(): Member[] {
    const sortedMembers = Array.from(this._members.values()).sort(
      (left, right) => left.index.toNumber() - right.index.toNumber()
    );
    return sortedMembers;
  }

  public async fetchMembers(options: FetchMembersOptions = {}): Promise<void> {
    const registeredMemberEvents = await RLNBaseContract.queryFilter(
      this.contract,
      {
        fromBlock: this.deployBlock,
        ...options,
        membersFilter: this.membersFilter
      }
    );
    const removedMemberEvents = await RLNBaseContract.queryFilter(
      this.contract,
      {
        fromBlock: this.deployBlock,
        ...options,
        membersFilter: this.membershipErasedFilter
      }
    );
    const expiredMemberEvents = await RLNBaseContract.queryFilter(
      this.contract,
      {
        fromBlock: this.deployBlock,
        ...options,
        membersFilter: this.membersExpiredFilter
      }
    );

    const events = [
      ...registeredMemberEvents,
      ...removedMemberEvents,
      ...expiredMemberEvents
    ];
    this.processEvents(events);
  }

  public static async queryFilter(
    contract: ethers.Contract,
    options: CustomQueryOptions
  ): Promise<ethers.Event[]> {
    const FETCH_CHUNK = 5;
    const BLOCK_RANGE = 3000;

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
    const chunks = RLNBaseContract.splitToChunks(
      fromBlock,
      toBlock,
      fetchRange
    );

    for (const portion of RLNBaseContract.takeN<[number, number]>(
      chunks,
      fetchChunks
    )) {
      const promises = portion.map(([left, right]) =>
        RLNBaseContract.ignoreErrors(
          contract.queryFilter(membersFilter, left, right),
          []
        )
      );
      const fetchedEvents = await Promise.all(promises);
      events.push(fetchedEvents.flatMap((v) => v));
    }

    return events.flatMap((v) => v);
  }

  public processEvents(events: ethers.Event[]): void {
    const toRemoveTable = new Map<number, number[]>();
    const toInsertTable = new Map<number, ethers.Event[]>();

    events.forEach((evt) => {
      if (!evt.args) {
        return;
      }

      if (
        evt.event === "MembershipErased" ||
        evt.event === "MembershipExpired"
      ) {
        let index = evt.args.index;

        if (!index) {
          return;
        }

        if (typeof index === "number" || typeof index === "string") {
          index = ethers.BigNumber.from(index);
        }

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
  }

  public static splitToChunks(
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

  public static *takeN<T>(array: T[], size: number): Iterable<T[]> {
    let start = 0;

    while (start < array.length) {
      const portion = array.slice(start, start + size);

      yield portion;

      start += size;
    }
  }

  public static async ignoreErrors<T>(
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

  public subscribeToMembers(): void {
    this.contract.on(
      this.membersFilter,
      (
        _idCommitment: string,
        _membershipRateLimit: ethers.BigNumber,
        _index: ethers.BigNumber,
        event: ethers.Event
      ) => {
        this.processEvents([event]);
      }
    );

    this.contract.on(
      this.membershipErasedFilter,
      (
        _idCommitment: string,
        _membershipRateLimit: ethers.BigNumber,
        _index: ethers.BigNumber,
        event: ethers.Event
      ) => {
        this.processEvents([event]);
      }
    );

    this.contract.on(
      this.membersExpiredFilter,
      (
        _idCommitment: string,
        _membershipRateLimit: ethers.BigNumber,
        _index: ethers.BigNumber,
        event: ethers.Event
      ) => {
        this.processEvents([event]);
      }
    );
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
      return Math.max(
        0,
        ethers.BigNumber.from(rateLimit)
          .sub(ethers.BigNumber.from(messageCount))
          .toNumber()
      );
    } catch (error) {
      log.error(
        `Error getting remaining messages: ${(error as Error).message}`
      );
      return 0; // Fail safe: assume no messages remaining on error
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

  public async withdraw(token: string, holder: string): Promise<void> {
    try {
      const tx = await this.contract.withdraw(token, { from: holder });
      await tx.wait();
    } catch (error) {
      log.error(`Error in withdraw: ${(error as Error).message}`);
    }
  }

  public async registerWithIdentity(
    identity: IdentityCredential
  ): Promise<DecryptedCredentials | undefined> {
    try {
      log.info(
        `Registering identity with rate limit: ${this.rateLimit} messages/epoch`
      );

      // Check if the ID commitment is already registered
      const existingIndex = await this.getMemberIndex(
        identity.IDCommitmentBigInt.toString()
      );
      if (existingIndex) {
        throw new Error(
          `ID commitment is already registered with index ${existingIndex}`
        );
      }

      // Check if there's enough remaining rate limit
      const remainingRateLimit = await this.getRemainingTotalRateLimit();
      if (remainingRateLimit < this.rateLimit) {
        throw new Error(
          `Not enough remaining rate limit. Requested: ${this.rateLimit}, Available: ${remainingRateLimit}`
        );
      }

      const estimatedGas = await this.contract.estimateGas.register(
        identity.IDCommitmentBigInt,
        this.rateLimit,
        []
      );
      const gasLimit = estimatedGas.add(10000);

      const txRegisterResponse: ethers.ContractTransaction =
        await this.contract.register(
          identity.IDCommitmentBigInt,
          this.rateLimit,
          [],
          { gasLimit }
        );

      const txRegisterReceipt = await txRegisterResponse.wait();

      if (txRegisterReceipt.status === 0) {
        throw new Error("Transaction failed on-chain");
      }

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
        membershipRateLimit: memberRegistered.args.membershipRateLimit,
        index: memberRegistered.args.index
      };

      log.info(
        `Successfully registered membership with index ${decodedData.index} ` +
          `and rate limit ${decodedData.membershipRateLimit}`
      );

      const network = await this.contract.provider.getNetwork();
      const address = this.contract.address;
      const membershipId = Number(decodedData.index);

      return {
        identity,
        membership: {
          address,
          treeIndex: membershipId,
          chainId: network.chainId,
          rateLimit: decodedData.membershipRateLimit.toNumber()
        }
      };
    } catch (error) {
      if (error instanceof Error) {
        const errorMessage = error.message;
        log.error("registerWithIdentity - error message:", errorMessage);
        log.error("registerWithIdentity - error stack:", error.stack);

        // Try to extract more specific error information
        if (errorMessage.includes("CannotExceedMaxTotalRateLimit")) {
          throw new Error(
            "Registration failed: Cannot exceed maximum total rate limit"
          );
        } else if (errorMessage.includes("InvalidIdCommitment")) {
          throw new Error("Registration failed: Invalid ID commitment");
        } else if (errorMessage.includes("InvalidMembershipRateLimit")) {
          throw new Error("Registration failed: Invalid membership rate limit");
        } else if (errorMessage.includes("execution reverted")) {
          throw new Error(
            "Contract execution reverted. Check contract requirements."
          );
        } else {
          throw new Error(`Error in registerWithIdentity: ${errorMessage}`);
        }
      } else {
        throw new Error("Unknown error in registerWithIdentity", {
          cause: error
        });
      }
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
        membershipRateLimit: memberRegistered.args.membershipRateLimit,
        index: memberRegistered.args.index
      };

      log.info(
        `Successfully registered membership with permit. Index: ${decodedData.index}, ` +
          `Rate limit: ${decodedData.membershipRateLimit}, Erased ${idCommitmentsToErase.length} commitments`
      );

      const network = await this.contract.provider.getNetwork();
      const address = this.contract.address;
      const membershipId = Number(decodedData.index);

      return {
        identity,
        membership: {
          address,
          treeIndex: membershipId,
          chainId: network.chainId,
          rateLimit: decodedData.membershipRateLimit.toNumber()
        }
      };
    } catch (error) {
      log.error(
        `Error in registerWithPermitAndErase: ${(error as Error).message}`
      );
      return undefined;
    }
  }

  /**
   * Validates that the rate limit is within the allowed range
   * @throws Error if the rate limit is outside the allowed range
   */
  private validateRateLimit(rateLimit: number): void {
    if (
      rateLimit < RATE_LIMIT_PARAMS.MIN_RATE ||
      rateLimit > RATE_LIMIT_PARAMS.MAX_RATE
    ) {
      throw new Error(
        `Rate limit must be between ${RATE_LIMIT_PARAMS.MIN_RATE} and ${RATE_LIMIT_PARAMS.MAX_RATE} messages per epoch`
      );
    }
  }

  private get membersFilter(): ethers.EventFilter {
    if (!this._membersFilter) {
      throw Error("Members filter was not initialized.");
    }
    return this._membersFilter;
  }

  private get membershipErasedFilter(): ethers.EventFilter {
    if (!this._membershipErasedFilter) {
      throw Error("MembershipErased filter was not initialized.");
    }
    return this._membershipErasedFilter;
  }

  private get membersExpiredFilter(): ethers.EventFilter {
    if (!this._membersExpiredFilter) {
      throw Error("MembersExpired filter was not initialized.");
    }
    return this._membersExpiredFilter;
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

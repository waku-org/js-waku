import { Logger } from "@waku/utils";
import { ethers } from "ethers";

import { IdentityCredential } from "../identity.js";
import { DecryptedCredentials } from "../keystore/types.js";

import { RLN_ABI } from "./abi.js";
import { DEFAULT_RATE_LIMIT, RATE_LIMIT_PARAMS } from "./constants.js";
import {
  InvalidMembershipError,
  InvalidRateLimitError,
  MembershipExistsError,
  MembershipNotFoundError,
  RateLimitExceededError,
  RLNContractError,
  TransactionError
} from "./errors.js";
import {
  Member,
  MembershipInfo,
  MembershipRegisteredEvent,
  MembershipState,
  RLNContractInitOptions
} from "./types.js";

const log = new Logger("waku:rln:contract:base");

export class RLNBaseContract {
  public contract: ethers.Contract;
  private rateLimit: number;

  public constructor(options: RLNContractInitOptions) {
    const {
      address,
      signer,
      rateLimit = DEFAULT_RATE_LIMIT,
      contract
    } = options;

    this.validateRateLimit(rateLimit);
    this.contract = contract || new ethers.Contract(address, RLN_ABI, signer);
    this.rateLimit = rateLimit;
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

  /**
   * Gets all members in the given range
   * @param startIndex Start index (inclusive)
   * @param endIndex End index (exclusive)
   */
  public async getMembersInRange(
    startIndex: number,
    endIndex: number
  ): Promise<Member[]> {
    try {
      // Get all commitments in one call
      const idCommitments =
        await this.contract.getRateCommitmentsInRangeBoundsInclusive(
          startIndex,
          endIndex - 1 // -1 because getRateCommitmentsInRangeBoundsInclusive is inclusive
        );

      // Get membership info for each commitment in a single batch
      const membershipPromises = idCommitments.map(
        (idCommitment: ethers.BigNumber) =>
          this.contract
            .memberships(idCommitment)
            .then((info: { index: number | ethers.BigNumber }) => ({
              idCommitment: idCommitment.toString(),
              index: ethers.BigNumber.from(info.index)
            }))
            .catch(() => null) // Skip invalid members
      );

      // Wait for all promises to resolve
      const members = (await Promise.all(membershipPromises)).filter(
        (m): m is Member => m !== null
      );
      return members;
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("InvalidPaginationQuery")
      ) {
        throw new RLNContractError(
          `Invalid pagination range: start=${startIndex}, end=${endIndex}`
        );
      }
      throw error;
    }
  }

  /**
   * Gets all current members
   */
  public async getAllMembers(): Promise<Member[]> {
    const nextIndex = (await this.contract.nextFreeIndex()).toNumber();
    return this.getMembersInRange(0, nextIndex);
  }

  /**
   * Gets the member index if it exists, or null if it doesn't
   * Throws only on actual errors (invalid input, network issues, etc)
   */
  private async getMemberIndex(
    idCommitment: string
  ): Promise<ethers.BigNumber | null> {
    try {
      const isValid = await this.contract.isInMembershipSet(idCommitment);
      if (!isValid) {
        return null;
      }

      const membershipInfo = await this.contract.memberships(idCommitment);
      return ethers.BigNumber.from(membershipInfo.index);
    } catch (error) {
      log.error(`Error getting member index: ${(error as Error).message}`);
      throw new InvalidMembershipError(idCommitment);
    }
  }

  public async getMembershipInfo(
    idCommitment: string
  ): Promise<MembershipInfo> {
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
      if (index === null) {
        throw new MembershipNotFoundError(idCommitment);
      }

      return {
        index,
        idCommitment,
        rateLimit: rateLimit.toNumber(),
        startBlock: startBlock.toNumber(),
        endBlock: endBlock.toNumber(),
        state
      };
    } catch (error) {
      if (error instanceof RLNContractError) {
        throw error;
      }
      log.error(`Error getting membership info: ${(error as Error).message}`);
      throw new InvalidMembershipError(idCommitment);
    }
  }

  public async extendMembership(idCommitment: string): Promise<void> {
    const tx = await this.contract.extendMemberships([idCommitment]);
    await this.confirmTransaction(tx, "MembershipExtended", (event) => ({
      idCommitment: event.args!.idCommitment,
      endBlock: event.args!.endBlock
    }));
  }

  public async eraseMembership(
    idCommitment: string,
    eraseFromMembershipSet: boolean = true
  ): Promise<void> {
    const tx = await this.contract.eraseMemberships(
      [idCommitment],
      eraseFromMembershipSet
    );
    await this.confirmTransaction(tx, "MembershipErased", (event) => ({
      idCommitment: event.args!.idCommitment,
      index: event.args!.index
    }));
  }

  public async registerMembership(
    idCommitment: string,
    rateLimit: number = DEFAULT_RATE_LIMIT
  ): Promise<void> {
    if (
      rateLimit < RATE_LIMIT_PARAMS.MIN_RATE ||
      rateLimit > RATE_LIMIT_PARAMS.MAX_RATE
    ) {
      throw new Error(
        `Rate limit must be between ${RATE_LIMIT_PARAMS.MIN_RATE} and ${RATE_LIMIT_PARAMS.MAX_RATE}`
      );
    }
    const tx = await this.contract.register(idCommitment, rateLimit, []);
    await this.confirmTransaction(tx, "MembershipRegistered", (event) => ({
      idCommitment: event.args!.idCommitment,
      membershipRateLimit: event.args!.membershipRateLimit,
      index: event.args!.index
    }));
  }

  public async withdraw(token: string, holder: string): Promise<void> {
    try {
      const tx = await this.contract.withdraw(token, { from: holder });
      await this.confirmTransaction(tx, "TokenWithdrawn", (event) => ({
        token: event.args!.token,
        holder: event.args!.holder,
        amount: event.args!.amount
      }));
    } catch (error) {
      log.error(`Error in withdraw: ${(error as Error).message}`);
      throw error;
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

      if (existingIndex !== null) {
        throw new MembershipExistsError(
          identity.IDCommitmentBigInt.toString(),
          existingIndex.toString()
        );
      }

      // Check if there's enough remaining rate limit
      const remainingRateLimit = await this.getRemainingTotalRateLimit();
      if (remainingRateLimit < this.rateLimit) {
        throw new RateLimitExceededError(this.rateLimit, remainingRateLimit);
      }

      const estimatedGas = await this.contract.estimateGas.register(
        identity.IDCommitmentBigInt,
        this.rateLimit,
        []
      );
      const gasLimit = estimatedGas.add(10000);

      const tx = await this.contract.register(
        identity.IDCommitmentBigInt,
        this.rateLimit,
        [],
        { gasLimit }
      );

      const decodedData = await this.confirmTransaction(
        tx,
        "MembershipRegistered",
        (event): MembershipRegisteredEvent => ({
          idCommitment: event.args!.idCommitment,
          membershipRateLimit: event.args!.membershipRateLimit,
          index: event.args!.index
        })
      );

      log.info(
        `Successfully registered membership with index ${decodedData.index} ` +
          `and rate limit ${decodedData.membershipRateLimit}`
      );

      const network = await this.contract.provider.getNetwork();
      const address = this.contract.address;
      const membershipId = decodedData.index.toString();

      return {
        identity,
        membership: {
          address,
          treeIndex: parseInt(membershipId),
          chainId: network.chainId.toString(),
          rateLimit: decodedData.membershipRateLimit.toNumber()
        }
      };
    } catch (error) {
      if (error instanceof RLNContractError) {
        throw error;
      }

      if (error instanceof Error) {
        const errorMessage = error.message;
        log.error("registerWithIdentity - error message:", errorMessage);
        log.error("registerWithIdentity - error stack:", error.stack);

        // Map contract errors to our custom errors
        if (errorMessage.includes("CannotExceedMaxTotalRateLimit")) {
          throw new RateLimitExceededError(
            this.rateLimit,
            await this.getRemainingTotalRateLimit()
          );
        } else if (errorMessage.includes("InvalidIdCommitment")) {
          throw new InvalidMembershipError(
            identity.IDCommitmentBigInt.toString()
          );
        } else if (errorMessage.includes("InvalidMembershipRateLimit")) {
          throw new InvalidRateLimitError(
            this.rateLimit,
            RATE_LIMIT_PARAMS.MIN_RATE,
            RATE_LIMIT_PARAMS.MAX_RATE
          );
        } else if (errorMessage.includes("execution reverted")) {
          throw new TransactionError(
            "Contract execution reverted. Check contract requirements."
          );
        }

        throw new RLNContractError(
          `Error in registerWithIdentity: ${errorMessage}`
        );
      }

      throw new RLNContractError("Unknown error in registerWithIdentity");
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

      const tx = await this.contract.registerWithPermit(
        permit.owner,
        permit.deadline,
        permit.v,
        permit.r,
        permit.s,
        identity.IDCommitmentBigInt,
        this.rateLimit,
        idCommitmentsToErase.map((id) => ethers.BigNumber.from(id))
      );

      const decodedData = await this.confirmTransaction(
        tx,
        "MembershipRegistered",
        (event): MembershipRegisteredEvent => ({
          idCommitment: event.args!.idCommitment,
          membershipRateLimit: event.args!.membershipRateLimit,
          index: event.args!.index
        })
      );

      log.info(
        `Successfully registered membership with permit. Index: ${decodedData.index}, ` +
          `Rate limit: ${decodedData.membershipRateLimit}, Erased ${idCommitmentsToErase.length} commitments`
      );

      const network = await this.contract.provider.getNetwork();
      const address = this.contract.address;
      const membershipId = decodedData.index.toString();

      return {
        identity,
        membership: {
          address,
          treeIndex: parseInt(membershipId),
          chainId: network.chainId.toString(),
          rateLimit: decodedData.membershipRateLimit.toNumber()
        }
      };
    } catch (error) {
      log.error(
        `Error in registerWithPermitAndErase: ${(error as Error).message}`
      );
      throw error;
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
      throw new InvalidRateLimitError(
        rateLimit,
        RATE_LIMIT_PARAMS.MIN_RATE,
        RATE_LIMIT_PARAMS.MAX_RATE
      );
    }
  }

  /**
   * Helper to confirm a transaction and extract event data
   */
  private async confirmTransaction<T>(
    tx: ethers.ContractTransaction,
    expectedEvent: string,
    transform: (event: ethers.Event) => T
  ): Promise<T> {
    const receipt = await tx.wait();
    const event = receipt.events?.find((e) => e.event === expectedEvent);

    if (!event || !event.args) {
      throw new TransactionError(`Expected event ${expectedEvent} not found`);
    }

    return transform(event);
  }
}

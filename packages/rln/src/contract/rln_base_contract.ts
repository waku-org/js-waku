import { Logger } from "@waku/utils";
import {
  type Address,
  decodeEventLog,
  getContract,
  GetContractEventsReturnType,
  GetContractReturnType,
  type Hash,
  PublicClient,
  WalletClient
} from "viem";

import { IdentityCredential } from "../identity.js";
import { DecryptedCredentials } from "../keystore/types.js";

import {
  DEFAULT_RATE_LIMIT,
  RATE_LIMIT_PARAMS,
  RLN_CONTRACT
} from "./constants.js";
import {
  FetchMembersOptions,
  Member,
  MembershipInfo,
  MembershipState,
  RLNContractOptions
} from "./types.js";
import { iPriceCalculatorAbi, wakuRlnV2Abi } from "./wagmi/generated.js";

const log = new Logger("rln:contract:base");

type MembershipEvents = GetContractEventsReturnType<
  typeof wakuRlnV2Abi,
  "MembershipRegistered" | "MembershipErased" | "MembershipExpired"
>;
export class RLNBaseContract {
  public contract: GetContractReturnType<
    typeof wakuRlnV2Abi,
    PublicClient | WalletClient
  >;
  public publicClient: PublicClient;
  public walletClient: WalletClient;
  private deployBlock: undefined | number;
  private rateLimit: number;
  private minRateLimit?: number;
  private maxRateLimit?: number;

  protected _members: Map<number, Member> = new Map();

  /**
   * Private constructor for RLNBaseContract. Use static create() instead.
   */
  protected constructor(options: RLNContractOptions) {
    const {
      address,
      publicClient,
      walletClient,
      rateLimit = DEFAULT_RATE_LIMIT
    } = options;

    log.info("Initializing RLNBaseContract", { address, rateLimit });

    this.publicClient = publicClient;
    this.walletClient = walletClient;
    this.contract = getContract({
      address,
      abi: wakuRlnV2Abi,
      client: { wallet: walletClient, public: publicClient }
    });
    this.rateLimit = rateLimit;

    // Initialize members and subscriptions
    this.fetchMembers()
      .then(() => {
        this.subscribeToMembers();
      })
      .catch((error) => {
        log.error("Failed to initialize members", { error });
      });
  }

  /**
   * Static async factory to create and initialize RLNBaseContract
   */
  public static async create(
    options: RLNContractOptions
  ): Promise<RLNBaseContract> {
    const instance = new RLNBaseContract(options);

    instance.deployBlock = await instance.contract.read.deployedBlockNumber();

    const [min, max] = await Promise.all([
      instance.contract.read.minMembershipRateLimit(),
      instance.contract.read.maxMembershipRateLimit()
    ]);

    instance.minRateLimit = min;
    instance.maxRateLimit = max;

    instance.validateRateLimit(instance.rateLimit);
    return instance;
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
   * Gets the minimum allowed rate limit (cached)
   */
  public getMinRateLimit(): number {
    if (this.minRateLimit === undefined)
      throw new Error("minRateLimit not initialized");
    return this.minRateLimit;
  }

  /**
   * Gets the maximum allowed rate limit (cached)
   */
  public getMaxRateLimit(): number {
    if (this.maxRateLimit === undefined)
      throw new Error("maxRateLimit not initialized");
    return this.maxRateLimit;
  }

  /**
   * Gets the maximum total rate limit across all memberships
   * @returns Promise<number> The maximum total rate limit in messages per epoch
   */
  public async getMaxTotalRateLimit(): Promise<number> {
    return await this.contract.read.maxTotalRateLimit();
  }

  /**
   * Gets the current total rate limit usage across all memberships
   * @returns Promise<number> The current total rate limit usage in messages per epoch
   */
  public async getCurrentTotalRateLimit(): Promise<number> {
    return Number(await this.contract.read.currentTotalRateLimit());
  }

  /**
   * Gets the remaining available total rate limit that can be allocated
   * @returns Promise<number> The remaining rate limit that can be allocated
   */
  public async getRemainingTotalRateLimit(): Promise<number> {
    return (
      (await this.contract.read.maxTotalRateLimit()) -
      Number(await this.contract.read.currentTotalRateLimit())
    );
  }

  /**
   * Updates the rate limit for future registrations
   * @param newRateLimit The new rate limit to use
   */
  public setRateLimit(newRateLimit: number): void {
    this.validateRateLimit(newRateLimit);
    this.rateLimit = newRateLimit;
  }

  /**
   * Gets the Merkle tree root for RLN proof verification
   * @returns Promise<bigint> The Merkle tree root
   *
   */
  public async getMerkleRoot(): Promise<bigint> {
    return this.contract.read.root();
  }

  /**
   * Gets the Merkle proof for a member at a given index
   * @param index The index of the member in the membership set
   * @returns Promise<bigint[]> Array of 20 Merkle proof elements
   *
   */
  public async getMerkleProof(index: number): Promise<readonly bigint[]> {
    return await this.contract.read.getMerkleProof([index]);
  }

  public get members(): Member[] {
    const sortedMembers = Array.from(this._members.values()).sort(
      (left, right) => Number(left.index) - Number(right.index)
    );
    return sortedMembers;
  }

  public async fetchMembers(options: FetchMembersOptions = {}): Promise<void> {
    const fromBlock = options.fromBlock
      ? BigInt(options.fromBlock!)
      : BigInt(this.deployBlock!);
    const registeredMemberEvents =
      await this.contract.getEvents.MembershipRegistered({
        fromBlock,
        toBlock: fromBlock + BigInt(options.fetchRange!)
      });
    const removedMemberEvents = await this.contract.getEvents.MembershipErased({
      fromBlock,
      toBlock: fromBlock + BigInt(options.fetchRange!)
    });
    const expiredMemberEvents = await this.contract.getEvents.MembershipExpired(
      {
        fromBlock,
        toBlock: fromBlock + BigInt(options.fetchRange!)
      }
    );

    const events = [
      ...registeredMemberEvents,
      ...removedMemberEvents,
      ...expiredMemberEvents
    ];
    this.processEvents(events);
  }

  public processEvents(events: MembershipEvents): void {
    const toRemoveTable = new Map<number, number[]>();
    const toInsertTable = new Map<number, MembershipEvents>();

    events.forEach((evt) => {
      if (!evt.args) {
        return;
      }
      const blockNumber = Number(evt.blockNumber);
      if (
        evt.eventName === "MembershipErased" ||
        evt.eventName === "MembershipExpired"
      ) {
        const index = evt.args.index;

        if (!index) {
          return;
        }

        const toRemoveVal = toRemoveTable.get(blockNumber);
        if (toRemoveVal != undefined) {
          toRemoveVal.push(index);
          toRemoveTable.set(blockNumber, toRemoveVal);
        } else {
          toRemoveTable.set(blockNumber, [index]);
        }
      } else if (evt.eventName === "MembershipRegistered") {
        let eventsPerBlock = toInsertTable.get(blockNumber);
        if (eventsPerBlock == undefined) {
          eventsPerBlock = [];
        }

        eventsPerBlock.push(evt);
        toInsertTable.set(blockNumber, eventsPerBlock);
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
    this.contract.watchEvent.MembershipRegistered({
      onLogs: (logs) => {
        this.processEvents(logs);
      }
    });
    this.contract.watchEvent.MembershipExpired({
      onLogs: (logs) => {
        this.processEvents(logs);
      }
    });
    this.contract.watchEvent.MembershipErased({
      onLogs: (logs) => {
        this.processEvents(logs);
      }
    });
  }

  public async getMembershipInfo(
    idCommitmentBigInt: bigint
  ): Promise<MembershipInfo | undefined> {
    try {
      const membershipData = await this.contract.read.memberships([
        idCommitmentBigInt
      ]);

      const currentBlock = await this.publicClient.getBlockNumber();

      const [
        depositAmount,
        activeDuration,
        gracePeriodStartTimestamp,
        gracePeriodDuration,
        rateLimit,
        index,
        holder,
        token
      ] = membershipData;

      const gracePeriodEnd =
        Number(gracePeriodStartTimestamp) + Number(gracePeriodDuration);

      let state: MembershipState;
      if (currentBlock < Number(gracePeriodStartTimestamp)) {
        state = MembershipState.Active;
      } else if (currentBlock < gracePeriodEnd) {
        state = MembershipState.GracePeriod;
      } else {
        state = MembershipState.Expired;
      }

      return {
        index,
        idCommitment: idCommitmentBigInt.toString(),
        rateLimit: rateLimit,
        startBlock: Number(gracePeriodStartTimestamp),
        endBlock: gracePeriodEnd,
        state,
        depositAmount,
        activeDuration,
        gracePeriodDuration,
        holder,
        token
      };
    } catch (error) {
      log.error("Error in getMembershipInfo:", error);
      return undefined;
    }
  }

  public async extendMembership(idCommitmentBigInt: bigint): Promise<Hash> {
    if (!this.walletClient.account) {
      throw new Error(
        "Failed to extendMembership: no account set in wallet client"
      );
    }
    try {
      await this.contract.simulate.extendMemberships([[idCommitmentBigInt]], {
        chain: this.walletClient.chain,
        account: this.walletClient.account!.address
      });
    } catch (err) {
      throw new Error("Simulating extending membership failed: " + err);
    }
    const hash = await this.contract.write.extendMemberships(
      [[idCommitmentBigInt]],
      {
        account: this.walletClient.account!,
        chain: this.walletClient.chain
      }
    );

    await this.publicClient.waitForTransactionReceipt({ hash });
    return hash;
  }

  public async eraseMembership(
    idCommitmentBigInt: bigint,
    eraseFromMembershipSet: boolean = true
  ): Promise<Hash> {
    if (
      !(await this.isExpired(idCommitmentBigInt)) ||
      !(await this.isInGracePeriod(idCommitmentBigInt))
    ) {
      throw new Error("Membership is not expired or in grace period");
    }
    if (!this.walletClient.account) {
      throw new Error(
        "Failed to eraseMembership: no account set in wallet client"
      );
    }

    try {
      await this.contract.simulate.eraseMemberships(
        [[idCommitmentBigInt], eraseFromMembershipSet],
        {
          chain: this.walletClient.chain,
          account: this.walletClient.account!.address
        }
      );
    } catch (err) {
      throw new Error("Error simulating eraseMemberships: " + err);
    }

    const hash = await this.contract.write.eraseMemberships(
      [[idCommitmentBigInt], eraseFromMembershipSet],
      {
        chain: this.walletClient.chain,
        account: this.walletClient.account!
      }
    );
    await this.publicClient.waitForTransactionReceipt({ hash });
    return hash;
  }

  public async registerMembership(
    idCommitmentBigInt: bigint,
    rateLimit: number = DEFAULT_RATE_LIMIT
  ): Promise<Hash> {
    if (
      rateLimit < RATE_LIMIT_PARAMS.MIN_RATE ||
      rateLimit > RATE_LIMIT_PARAMS.MAX_RATE
    ) {
      throw new Error(
        `Rate limit must be between ${RATE_LIMIT_PARAMS.MIN_RATE} and ${RATE_LIMIT_PARAMS.MAX_RATE}`
      );
    }
    if (!this.walletClient.account) {
      throw new Error(
        "Failed to registerMembership: no account set in wallet client"
      );
    }
    try {
      await this.contract.simulate.register(
        [idCommitmentBigInt, rateLimit, []],
        {
          chain: this.walletClient.chain,
          account: this.walletClient.account!.address
        }
      );
    } catch (err) {
      throw new Error("Failed to simulate register membership: " + err);
    }

    const hash = await this.contract.write.register(
      [idCommitmentBigInt, rateLimit, []],
      {
        chain: this.walletClient.chain,
        account: this.walletClient.account!
      }
    );
    await this.publicClient.waitForTransactionReceipt({ hash });
    return hash;
  }

  /**
   * Withdraw deposited tokens after membership is erased
   * @param token - Token address to withdraw
   * NOTE: Funds are sent to msg.sender (the walletClient's address)
   */
  public async withdraw(token: string): Promise<Hash> {
    if (!this.walletClient.account) {
      throw new Error("Failed to withdraw: no account set in wallet client");
    }

    try {
      await this.contract.simulate.withdraw([token as Address], {
        chain: this.walletClient.chain,
        account: this.walletClient.account!.address
      });
    } catch (err) {
      throw new Error("Error simulating withdraw: " + err);
    }

    const hash = await this.contract.write.withdraw([token as Address], {
      chain: this.walletClient.chain,
      account: this.walletClient.account!
    });

    await this.publicClient.waitForTransactionReceipt({ hash });
    return hash;
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
        identity.IDCommitmentBigInt
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

      await this.contract.simulate.register(
        [identity.IDCommitmentBigInt, this.rateLimit, []],
        {
          chain: this.walletClient.chain,
          account: this.walletClient.account!.address
        }
      );

      const hash: Hash = await this.contract.write.register(
        [identity.IDCommitmentBigInt, this.rateLimit, []],
        {
          chain: this.walletClient.chain,
          account: this.walletClient.account!
        }
      );

      const txRegisterReceipt =
        await this.publicClient.waitForTransactionReceipt({
          hash
        });

      if (txRegisterReceipt.status === "reverted") {
        throw new Error("Transaction failed on-chain");
      }

      // Parse MembershipRegistered event from logs
      const memberRegisteredLog = txRegisterReceipt.logs.find((log) => {
        try {
          const decoded = decodeEventLog({
            abi: wakuRlnV2Abi,
            data: log.data,
            topics: log.topics
          });
          return decoded.eventName === "MembershipRegistered";
        } catch {
          return false;
        }
      });

      if (!memberRegisteredLog) {
        log.error(
          "Failed to register membership: No MembershipRegistered event found"
        );
        return undefined;
      }

      // Decode the event
      const decoded = decodeEventLog({
        abi: wakuRlnV2Abi,
        data: memberRegisteredLog.data,
        topics: memberRegisteredLog.topics
      });

      const decodedArgs = decoded.args as {
        idCommitment: bigint;
        membershipRateLimit: number;
        index: number;
      };

      log.info(
        `Successfully registered membership with index ${decodedArgs.index} ` +
          `and rate limit ${decodedArgs.membershipRateLimit}`
      );

      return {
        identity,
        membership: {
          address: this.contract.address,
          treeIndex: decodedArgs.index,
          chainId: String(RLN_CONTRACT.chainId),
          rateLimit: decodedArgs.membershipRateLimit
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

  /**
   * Validates that the rate limit is within the allowed range (sync)
   * @throws Error if the rate limit is outside the allowed range
   */
  private validateRateLimit(rateLimit: number): void {
    if (this.minRateLimit === undefined || this.maxRateLimit === undefined) {
      throw new Error("Rate limits not initialized");
    }
    if (rateLimit < this.minRateLimit || rateLimit > this.maxRateLimit) {
      throw new Error(
        `Rate limit must be between ${this.minRateLimit} and ${this.maxRateLimit} messages per epoch`
      );
    }
  }

  private async getMemberIndex(idCommitmentBigInt: bigint): Promise<number> {
    return (await this.contract.read.memberships([idCommitmentBigInt]))[5];
  }

  public async getMembershipStatus(
    idCommitment: bigint
  ): Promise<"expired" | "grace" | "active"> {
    const [isExpired, isInGrace] = await Promise.all([
      this.contract.read.isExpired([idCommitment]),
      this.contract.read.isInGracePeriod([idCommitment])
    ]);

    if (isExpired) return "expired";
    if (isInGrace) return "grace";
    return "active";
  }

  /**
   * Checks if a membership is expired for the given idCommitment
   * @param idCommitmentBigInt The idCommitment as bigint
   * @returns Promise<boolean> True if expired, false otherwise
   */
  public async isExpired(idCommitmentBigInt: bigint): Promise<boolean> {
    try {
      return await this.contract.read.isExpired([idCommitmentBigInt]);
    } catch (error) {
      log.error("Error in isExpired:", error);
      return false;
    }
  }

  /**
   * Checks if a membership is in grace period for the given idCommitment
   * @param idCommitmentBigInt The idCommitment as bigint
   * @returns Promise<boolean> True if in grace period, false otherwise
   */
  public async isInGracePeriod(idCommitmentBigInt: bigint): Promise<boolean> {
    try {
      return await this.contract.read.isInGracePeriod([idCommitmentBigInt]);
    } catch (error) {
      log.error("Error in isInGracePeriod:", error);
      return false;
    }
  }

  /**
   * Calculates the price for a given rate limit using the PriceCalculator contract
   * @param rateLimit The rate limit to calculate the price for
   * @param contractFactory Optional factory for creating the contract (for testing)
   */
  public async getPriceForRateLimit(rateLimit: number): Promise<{
    token: string | null;
    price: bigint | null;
  }> {
    const address = await this.contract.read.priceCalculator();
    const [token, price] = await this.publicClient.readContract({
      address,
      abi: iPriceCalculatorAbi,
      functionName: "calculate",
      args: [rateLimit]
    });

    // Defensive: if token or price is null/undefined, return nulls
    if (!token || !price) {
      return { token: null, price: null };
    }
    return { token, price };
  }
}

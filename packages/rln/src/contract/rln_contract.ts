import { Logger } from "@waku/utils";
import { hexToBytes } from "@waku/utils/bytes";

import type { RLNInstance } from "../rln.js";
import { MerkleRootTracker } from "../root_tracker.js";
import { zeroPadLE } from "../utils/bytes.js";

import { ContractStateError } from "./errors.js";
import { RLNBaseContract } from "./rln_base_contract.js";
import { RLNContractInitOptions } from "./types.js";

const log = new Logger("waku:rln:contract");

export class RLNContract extends RLNBaseContract {
  private instance: RLNInstance;
  private merkleRootTracker: MerkleRootTracker;
  private lastSyncedBlock: number = 0;

  /**
   * Asynchronous initializer for RLNContract.
   * Allows injecting a mocked contract for testing purposes.
   */
  public static async init(
    rlnInstance: RLNInstance,
    options: RLNContractInitOptions
  ): Promise<RLNContract> {
    const rlnContract = new RLNContract(rlnInstance, options);
    await rlnContract.syncState();
    return rlnContract;
  }

  /**
   * Override base contract method to keep Merkle tree in sync
   * Registers a new membership with the given commitment and rate limit
   */
  public override async registerMembership(
    idCommitment: string,
    rateLimit: number = this.getRateLimit()
  ): Promise<void> {
    await super.registerMembership(idCommitment, rateLimit);
    await this.syncState();
  }

  /**
   * Override base contract method to keep Merkle tree in sync
   * Erases an existing membership from the contract
   */
  public override async eraseMembership(
    idCommitment: string,
    eraseFromMembershipSet: boolean = true
  ): Promise<void> {
    await super.eraseMembership(idCommitment, eraseFromMembershipSet);
    await this.syncState();
  }

  /**
   * Gets the current Merkle root
   * Returns the latest valid root or empty array if no roots exist
   */
  public async getMerkleRoot(): Promise<Uint8Array> {
    await this.syncState();
    const roots = this.merkleRootTracker.roots();
    return roots.length > 0 ? roots[0] : new Uint8Array();
  }

  private constructor(
    rlnInstance: RLNInstance,
    options: RLNContractInitOptions
  ) {
    super(options);
    this.instance = rlnInstance;
    const initialRoot = rlnInstance.zerokit.getMerkleRoot();
    this.merkleRootTracker = new MerkleRootTracker(5, initialRoot);
  }

  /**
   * Syncs the local Merkle tree with the current contract state
   */
  private async syncState(): Promise<void> {
    try {
      const currentBlock = await this.provider.getBlockNumber();

      // If we're already synced, just get new members
      if (this.lastSyncedBlock > 0) {
        await this.syncNewMembers(this.lastSyncedBlock, currentBlock);
        this.lastSyncedBlock = currentBlock;
        return;
      }

      // First time sync - get all members
      const nextIndex = await this.contract.nextFreeIndex();
      const members = await this.getMembersInRange(0, nextIndex.toNumber());

      // Clear existing members by deleting them one by one
      // This effectively resets the tree without needing resetTree()
      for (let i = 0; i < nextIndex.toNumber(); i++) {
        try {
          this.instance.zerokit.deleteMember(i);
        } catch (error) {
          // Ignore errors for non-existent members
          continue;
        }
      }

      // Insert all members
      for (const member of members) {
        const idCommitment = zeroPadLE(hexToBytes(member.idCommitment), 32);
        this.instance.zerokit.insertMember(idCommitment);
      }

      // Update root tracker
      const currentRoot = this.instance.zerokit.getMerkleRoot();
      this.merkleRootTracker.pushRoot(currentBlock, currentRoot);
      this.lastSyncedBlock = currentBlock;

      log.info(
        `Synced ${members.length} members to current block ${currentBlock}`
      );
    } catch (error) {
      log.error("Failed to sync state", error);
      throw new ContractStateError("Failed to sync contract state");
    }
  }

  /**
   * Syncs new members added between fromBlock and toBlock
   */
  private async syncNewMembers(
    fromBlock: number,
    toBlock: number
  ): Promise<void> {
    // Get members that were added
    const filter = this.contract.filters.MembershipRegistered();
    const addEvents = await this.contract.queryFilter(
      filter,
      fromBlock,
      toBlock
    );

    // Get members that were removed
    const removeFilter = this.contract.filters.MembershipErased();
    const removeEvents = await this.contract.queryFilter(
      removeFilter,
      fromBlock,
      toBlock
    );

    // Process removals first (in reverse block order)
    for (const evt of removeEvents.sort(
      (a, b) => b.blockNumber - a.blockNumber
    )) {
      if (!evt.args) continue;
      const index = evt.args.index.toNumber();
      this.instance.zerokit.deleteMember(index);
      this.merkleRootTracker.backFill(evt.blockNumber);
    }

    // Then process additions
    for (const evt of addEvents) {
      if (!evt.args) continue;
      const idCommitment = zeroPadLE(hexToBytes(evt.args.idCommitment), 32);
      this.instance.zerokit.insertMember(idCommitment);
      this.merkleRootTracker.pushRoot(
        evt.blockNumber,
        this.instance.zerokit.getMerkleRoot()
      );
    }
  }
}

import { Logger } from "@waku/utils";
import { hexToBytes } from "@waku/utils/bytes";
import { ethers } from "ethers";

import type { IdentityCredential } from "../identity.js";
import type { DecryptedCredentials } from "../keystore/index.js";
import type { RLNInstance } from "../rln.js";
import { MerkleRootTracker } from "../root_tracker.js";
import { zeroPadLE } from "../utils/index.js";

import { RLN_V2_ABI } from "./abi/rlnv2.js";
import {
  FetchMembersOptions,
  MembershipRegisteredEvent,
  RLNContractInitOptions
} from "./types.js";
import { Member } from "./types.js";

const log = new Logger("waku:rln:contract");

export class RLNContract {
  private contract: ethers.Contract;
  private merkleRootTracker: MerkleRootTracker;

  private deployBlock: undefined | number;
  private rateLimit: number;
  private _membersFilter: ethers.EventFilter;
  private _membersRemovedFilter: ethers.EventFilter;

  private _members: Map<number, Member> = new Map();

  /**
   * Asynchronous initializer for RLNContract.
   * Allows injecting a mocked registryContract for testing purposes.
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
  /**
   * Private constructor to enforce the use of the async init method.
   */
  private constructor(
    rlnInstance: RLNInstance,
    options: RLNContractInitOptions
  ) {
    const { address, signer, rateLimit, contract } = options;

    if (rateLimit === undefined) {
      throw new Error("rateLimit must be provided in RLNContractOptions.");
    }

    this.rateLimit = rateLimit;

    const initialRoot = rlnInstance.zerokit.getMerkleRoot();

    // Use the injected registryContract if provided; otherwise, instantiate a new one.
    this.contract =
      contract || new ethers.Contract(address, RLN_V2_ABI, signer);
    this.merkleRootTracker = new MerkleRootTracker(5, initialRoot);

    // Initialize event filters for MembershipRegistered and MembershipRemoved
    this._membersFilter = this.contract.filters.MembershipRegistered();
    this._membersRemovedFilter = this.contract.filters.MembershipRemoved();
  }

  public get registry(): ethers.Contract {
    return this.contract;
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
    const removeDescending = new Map([...toRemove].sort((a, b) => b[0] - a[0]));
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
        return undefined;
      }

      const decodedData: MembershipRegisteredEvent = {
        idCommitment: memberRegistered.args.idCommitment,
        rateLimit: memberRegistered.args.rateLimit,
        index: memberRegistered.args.index
      };

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
        return undefined;
      }

      const decodedData: MembershipRegisteredEvent = {
        idCommitment: memberRegistered.args.idCommitment,
        rateLimit: memberRegistered.args.rateLimit,
        index: memberRegistered.args.index
      };

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

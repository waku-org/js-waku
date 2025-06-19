import { Logger } from "@waku/utils";
import { hexToBytes } from "@waku/utils/bytes";
import { ethers } from "ethers";

import type { RLNInstance } from "../rln.js";
import { MerkleRootTracker } from "../root_tracker.js";
import { BytesUtils } from "../utils/bytes.js";

import { RLNBaseContract } from "./rln_base_contract.js";
import { RLNContractInitOptions } from "./types.js";

const log = new Logger("waku:rln:contract");

export class RLNContract extends RLNBaseContract {
  private instance: RLNInstance;
  private merkleRootTracker: MerkleRootTracker;

  /**
   * Asynchronous initializer for RLNContract.
   * Allows injecting a mocked contract for testing purposes.
   */
  public static async init(
    rlnInstance: RLNInstance,
    options: RLNContractInitOptions
  ): Promise<RLNContract> {
    const rlnContract = new RLNContract(rlnInstance, options);

    return rlnContract;
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

  public override processEvents(events: ethers.Event[]): void {
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
        } else {
          log.error("Index is not a number or string", {
            index,
            event: evt
          });
          return;
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

    this.removeMembers(this.instance, toRemoveTable);
    this.insertMembers(this.instance, toInsertTable);
  }

  private insertMembers(
    rlnInstance: RLNInstance,
    toInsert: Map<number, ethers.Event[]>
  ): void {
    toInsert.forEach((events: ethers.Event[], blockNumber: number) => {
      events.forEach((evt) => {
        if (!evt.args) return;

        const _idCommitment = evt.args.idCommitment as string;
        let index = evt.args.index;

        if (!_idCommitment || !index) {
          return;
        }

        if (typeof index === "number" || typeof index === "string") {
          index = ethers.BigNumber.from(index);
        }

        const idCommitment = BytesUtils.zeroPadLE(
          hexToBytes(_idCommitment),
          32
        );
        rlnInstance.zerokit.insertMember(idCommitment);

        const numericIndex = index.toNumber();
        this._members.set(numericIndex, {
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
}

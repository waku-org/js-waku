import type { IRateLimitProof } from "@waku/interfaces";
import * as zerokitRLN from "@waku/zerokit-rln-wasm";

import { DEFAULT_RATE_LIMIT, RATE_LIMIT_PARAMS } from "./contract/constants.js";
import { IdentityCredential } from "./identity.js";
import { Proof, proofToBytes } from "./proof.js";
import { WitnessCalculator } from "./resources/witness_calculator";
import { BytesUtils, dateToEpoch, epochIntToBytes } from "./utils/index.js";

export class Zerokit {
  public constructor(
    private readonly zkRLN: number,
    private readonly witnessCalculator: WitnessCalculator,
    private readonly _rateLimit: number = DEFAULT_RATE_LIMIT
  ) {}

  public get getZkRLN(): number {
    return this.zkRLN;
  }

  public get getWitnessCalculator(): WitnessCalculator {
    return this.witnessCalculator;
  }

  public get rateLimit(): number {
    return this._rateLimit;
  }

  public generateIdentityCredentials(): IdentityCredential {
    const memKeys = zerokitRLN.generateExtendedMembershipKey(this.zkRLN); // TODO: rename this function in zerokit rln-wasm
    return IdentityCredential.fromBytes(memKeys);
  }

  public generateSeededIdentityCredential(seed: string): IdentityCredential {
    const stringEncoder = new TextEncoder();
    const seedBytes = stringEncoder.encode(seed);
    // TODO: rename this function in zerokit rln-wasm
    const memKeys = zerokitRLN.generateSeededExtendedMembershipKey(
      this.zkRLN,
      seedBytes
    );
    return IdentityCredential.fromBytes(memKeys);
  }

  public insertMember(idCommitment: Uint8Array): void {
    zerokitRLN.insertMember(this.zkRLN, idCommitment);
  }

  public insertMembers(
    index: number,
    ...idCommitments: Array<Uint8Array>
  ): void {
    // serializes a seq of IDCommitments to a byte seq
    // the order of serialization is |id_commitment_len<8>|id_commitment<var>|
    const idCommitmentLen = BytesUtils.writeUIntLE(
      new Uint8Array(8),
      idCommitments.length,
      0,
      8
    );
    const idCommitmentBytes = BytesUtils.concatenate(
      idCommitmentLen,
      ...idCommitments
    );
    zerokitRLN.setLeavesFrom(this.zkRLN, index, idCommitmentBytes);
  }

  public deleteMember(index: number): void {
    zerokitRLN.deleteLeaf(this.zkRLN, index);
  }

  public getMerkleRoot(): Uint8Array {
    return zerokitRLN.getRoot(this.zkRLN);
  }

  public serializeMessage(
    uint8Msg: Uint8Array,
    memIndex: number,
    epoch: Uint8Array,
    idKey: Uint8Array,
    rateLimit?: number
  ): Uint8Array {
    // calculate message length
    const msgLen = BytesUtils.writeUIntLE(
      new Uint8Array(8),
      uint8Msg.length,
      0,
      8
    );
    const memIndexBytes = BytesUtils.writeUIntLE(
      new Uint8Array(8),
      memIndex,
      0,
      8
    );
    const rateLimitBytes = BytesUtils.writeUIntLE(
      new Uint8Array(8),
      rateLimit ?? this.rateLimit,
      0,
      8
    );

    // [ id_key<32> | id_index<8> | epoch<32> | signal_len<8> | signal<var> | rate_limit<8> ]
    return BytesUtils.concatenate(
      idKey,
      memIndexBytes,
      epoch,
      msgLen,
      uint8Msg,
      rateLimitBytes
    );
  }

  public async generateRLNProof(
    msg: Uint8Array,
    index: number,
    epoch: Uint8Array | Date | undefined,
    idSecretHash: Uint8Array,
    rateLimit?: number
  ): Promise<IRateLimitProof> {
    if (epoch === undefined) {
      epoch = epochIntToBytes(dateToEpoch(new Date()));
    } else if (epoch instanceof Date) {
      epoch = epochIntToBytes(dateToEpoch(epoch));
    }

    const effectiveRateLimit = rateLimit ?? this.rateLimit;

    if (epoch.length !== 32) throw new Error("invalid epoch");
    if (idSecretHash.length !== 32) throw new Error("invalid id secret hash");
    if (index < 0) throw new Error("index must be >= 0");
    if (
      effectiveRateLimit < RATE_LIMIT_PARAMS.MIN_RATE ||
      effectiveRateLimit > RATE_LIMIT_PARAMS.MAX_RATE
    ) {
      throw new Error(
        `Rate limit must be between ${RATE_LIMIT_PARAMS.MIN_RATE} and ${RATE_LIMIT_PARAMS.MAX_RATE}`
      );
    }

    const serialized_msg = this.serializeMessage(
      msg,
      index,
      epoch,
      idSecretHash,
      effectiveRateLimit
    );
    const rlnWitness = zerokitRLN.getSerializedRLNWitness(
      this.zkRLN,
      serialized_msg
    );
    const inputs = zerokitRLN.RLNWitnessToJson(this.zkRLN, rlnWitness);
    const calculatedWitness = await this.witnessCalculator.calculateWitness(
      inputs,
      false
    );

    const proofBytes = zerokitRLN.generate_rln_proof_with_witness(
      this.zkRLN,
      calculatedWitness,
      rlnWitness
    );

    return new Proof(proofBytes);
  }

  public verifyRLNProof(
    proof: IRateLimitProof | Uint8Array,
    msg: Uint8Array,
    rateLimit?: number
  ): boolean {
    let pBytes: Uint8Array;
    if (proof instanceof Uint8Array) {
      pBytes = proof;
    } else {
      pBytes = proofToBytes(proof);
    }

    // calculate message length
    const msgLen = BytesUtils.writeUIntLE(new Uint8Array(8), msg.length, 0, 8);
    const rateLimitBytes = BytesUtils.writeUIntLE(
      new Uint8Array(8),
      rateLimit ?? this.rateLimit,
      0,
      8
    );

    return zerokitRLN.verifyRLNProof(
      this.zkRLN,
      BytesUtils.concatenate(pBytes, msgLen, msg, rateLimitBytes)
    );
  }

  public verifyWithRoots(
    proof: IRateLimitProof | Uint8Array,
    msg: Uint8Array,
    roots: Array<Uint8Array>,
    rateLimit?: number
  ): boolean {
    let pBytes: Uint8Array;
    if (proof instanceof Uint8Array) {
      pBytes = proof;
    } else {
      pBytes = proofToBytes(proof);
    }
    // calculate message length
    const msgLen = BytesUtils.writeUIntLE(new Uint8Array(8), msg.length, 0, 8);
    const rateLimitBytes = BytesUtils.writeUIntLE(
      new Uint8Array(8),
      rateLimit ?? this.rateLimit,
      0,
      8
    );

    const rootsBytes = BytesUtils.concatenate(...roots);

    return zerokitRLN.verifyWithRoots(
      this.zkRLN,
      BytesUtils.concatenate(pBytes, msgLen, msg, rateLimitBytes),
      rootsBytes
    );
  }

  public verifyWithNoRoot(
    proof: IRateLimitProof | Uint8Array,
    msg: Uint8Array,
    rateLimit?: number
  ): boolean {
    let pBytes: Uint8Array;
    if (proof instanceof Uint8Array) {
      pBytes = proof;
    } else {
      pBytes = proofToBytes(proof);
    }

    // calculate message length
    const msgLen = BytesUtils.writeUIntLE(new Uint8Array(8), msg.length, 0, 8);
    const rateLimitBytes = BytesUtils.writeUIntLE(
      new Uint8Array(8),
      rateLimit ?? this.rateLimit,
      0,
      8
    );

    return zerokitRLN.verifyWithRoots(
      this.zkRLN,
      BytesUtils.concatenate(pBytes, msgLen, msg, rateLimitBytes),
      new Uint8Array()
    );
  }
}

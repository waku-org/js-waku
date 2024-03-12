import { buildBigIntFromUint8Array } from "./utils/index.js";

export class IdentityCredential {
  constructor(
    public readonly IDTrapdoor: Uint8Array,
    public readonly IDNullifier: Uint8Array,
    public readonly IDSecretHash: Uint8Array,
    public readonly IDCommitment: Uint8Array,
    public readonly IDCommitmentBigInt: bigint
  ) {}

  static fromBytes(memKeys: Uint8Array): IdentityCredential {
    const idTrapdoor = memKeys.subarray(0, 32);
    const idNullifier = memKeys.subarray(32, 64);
    const idSecretHash = memKeys.subarray(64, 96);
    const idCommitment = memKeys.subarray(96);
    const idCommitmentBigInt = buildBigIntFromUint8Array(idCommitment);

    return new IdentityCredential(
      idTrapdoor,
      idNullifier,
      idSecretHash,
      idCommitment,
      idCommitmentBigInt
    );
  }
}

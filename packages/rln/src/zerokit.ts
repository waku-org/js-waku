import * as zerokitRLN from "@waku/zerokit-rln-wasm";

import { DEFAULT_RATE_LIMIT } from "./contract/constants.js";
import { IdentityCredential } from "./identity.js";
import { WitnessCalculator } from "./resources/witness_calculator";

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
}

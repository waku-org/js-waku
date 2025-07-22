export const builder: (
  code: Uint8Array,
  sanityCheck?: boolean
) => Promise<WitnessCalculator>;

export class WitnessCalculator {
  constructor(instance: any, sanityCheck?: boolean);

  circom_version(): number;

  calculateWitness(
    input: Record<string, unknown>,
    sanityCheck?: boolean
  ): Promise<bigint[]>;

  calculateBinWitness(
    input: Record<string, unknown>,
    sanityCheck?: boolean
  ): Promise<Uint8Array>;

  calculateWTNSBin(
    input: Record<string, unknown>,
    sanityCheck?: boolean
  ): Promise<Uint8Array>;
}

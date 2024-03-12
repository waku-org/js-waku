export async function builder(
  code: Uint8Array,
  sanityCheck: bool
): Promise<WitnessCalculator>;

export class WitnessCalculator {
  calculateWitness(input, sanityCheck): Promise<Array<bigint>>;
}

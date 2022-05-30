import { shuffle } from "libp2p-gossipsub/src/utils/index";

export function getPseudoRandomSubset<T>(
  values: T[],
  wantedNumber: number
): T[] {
  if (values.length <= wantedNumber) {
    return values;
  }

  return shuffle(values).slice(0, wantedNumber);
}

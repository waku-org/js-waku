import { shuffle } from "libp2p-gossipsub/src/utils";

export { getPredefinedBootstrapNodes } from "./predefined";
export * as predefined from "./predefined";
export * as bootstrap from "./bootstrap";
export * as enrtree from "./enrtree";
export * as dns from "./dns";
export * as dns_over_https from "./dns_over_https";
export { ENRTree } from "./enrtree";

export function getPseudoRandomSubset<T>(
  values: T[],
  wantedNumber: number
): T[] {
  if (values.length <= wantedNumber) {
    return values;
  }

  return shuffle(values).slice(0, wantedNumber);
}

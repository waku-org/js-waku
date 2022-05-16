import { shuffle } from "libp2p-gossipsub/src/utils";

export { getPredefinedBootstrapNodes } from "./predefined";
export * as predefined from "./predefined";
export { Bootstrap, BootstrapOptions } from "./bootstrap";
export * as dns from "./dns";
export { Endpoints, DnsOverHttps } from "./dns_over_https";
export { ENRTree, ENRTreeValues, ENRRootValues } from "./enrtree";

export function getPseudoRandomSubset<T>(
  values: T[],
  wantedNumber: number
): T[] {
  if (values.length <= wantedNumber) {
    return values;
  }

  return shuffle(values).slice(0, wantedNumber);
}

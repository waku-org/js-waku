import { shuffle } from "libp2p-gossipsub/src/utils";

import * as _bootstrap from "./bootstrap";
import * as _dns from "./dns";
import * as _dns_over_https from "./dns_over_https";
import * as _enrtree from "./enrtree";
import * as _predefined from "./predefined";

export const bootstrap = { ..._bootstrap };
export const dns = { ..._dns };
export const dns_over_https = { ..._dns_over_https };
export { ENRTree } from "./enrtree";
export const enrtree = { ..._enrtree };
export { getPredefinedBootstrapNodes } from "./predefined";
export const predefined = { ..._predefined };

export function getPseudoRandomSubset<T>(
  values: T[],
  wantedNumber: number
): T[] {
  if (values.length <= wantedNumber) {
    return values;
  }

  return shuffle(values).slice(0, wantedNumber);
}

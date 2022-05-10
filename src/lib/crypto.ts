import nodeCrypto from "crypto";

import * as secp from "@noble/secp256k1";

declare const self: Record<string, any> | undefined;
const crypto: { node?: any; web?: any } = {
  node: nodeCrypto,
  web: typeof self === "object" && "crypto" in self ? self.crypto : undefined,
};

export function getSubtle(): SubtleCrypto {
  if (crypto.web) {
    return crypto.web.subtle;
  } else if (crypto.node) {
    return crypto.node.webcrypto.subtle;
  } else {
    throw new Error(
      "The environment doesn't have Crypto Subtle API (if in the browser, be sure to use to be in a secure context, ie, https)"
    );
  }
}

export const randomBytes = secp.utils.randomBytes;
export const sha256 = secp.utils.sha256;

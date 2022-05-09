import nodeCrypto from "crypto";

import { concat } from "uint8arrays/concat";

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

export function randomBytes(bytesLength = 32): Uint8Array {
  if (crypto.web) {
    return crypto.web.getRandomValues(new Uint8Array(bytesLength));
  } else if (crypto.node) {
    const { randomBytes } = crypto.node;
    return Uint8Array.from(randomBytes(bytesLength));
  } else {
    throw new Error(
      "The environment doesn't have randomBytes function (if in the browser, be sure to use to be in a secure context, ie, https)"
    );
  }
}

export async function sha256(...messages: Uint8Array[]): Promise<Uint8Array> {
  if (crypto.web) {
    const buffer = await crypto.web.subtle.digest("SHA-256", concat(messages));
    return new Uint8Array(buffer);
  } else if (crypto.node) {
    const { createHash } = crypto.node;
    const hash = createHash("sha256");
    messages.forEach((m) => hash.update(m));
    return Uint8Array.from(hash.digest());
  } else {
    throw new Error("The environment doesn't have sha256 function");
  }
}

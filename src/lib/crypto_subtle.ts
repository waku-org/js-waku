import nodeCrypto from "crypto";

// Types do not seem up-to-date
const crypto: Crypto = nodeCrypto.webcrypto as unknown as Crypto;
if (crypto === undefined) {
  throw new Error("node crypto api unavailable");
}

const subtle: SubtleCrypto = crypto.subtle || crypto.webkitSubtle;

if (subtle === undefined) {
  throw new Error("node subtle api unavailable");
}

export { crypto, subtle };

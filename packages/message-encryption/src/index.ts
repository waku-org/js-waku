import {
  generatePrivateKey,
  generateSymmetricKey,
  getPublicKey
} from "./helpers/crypto/index.js";
import { DecodedMessage } from "./lib/decoded_message.js";

export const OneMillion = BigInt(1_000_000);

export { generatePrivateKey, generateSymmetricKey, getPublicKey };
export type { DecodedMessage };

export * as ecies from "./lib/ecies.js";
export * as symmetric from "./lib/symmetric.js";

export const Version = 1;

export type Signature = {
  signature: Uint8Array;
  publicKey: Uint8Array | undefined;
};

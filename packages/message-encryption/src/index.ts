import {
  generatePrivateKey,
  generateSymmetricKey,
  getPublicKey
} from "./crypto/index.js";
import { DecodedMessage } from "./decoded_message.js";

export const OneMillion = BigInt(1_000_000);

export { generatePrivateKey, generateSymmetricKey, getPublicKey };
export type { DecodedMessage };

export * as ecies from "./ecies.js";
export * as symmetric from "./symmetric.js";

export const Version = 1;

export type Signature = {
  signature: Uint8Array;
  publicKey: Uint8Array | undefined;
};

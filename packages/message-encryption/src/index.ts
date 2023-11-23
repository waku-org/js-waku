import {
  generatePrivateKey,
  generateSymmetricKey,
  getPublicKey
} from "./crypto/index.js";
import { DecodedMessage } from "./decoded_message.js";

export { generatePrivateKey, generateSymmetricKey, getPublicKey };
export type { DecodedMessage };

export * as ecies from "./ecies.js";
export * as symmetric from "./symmetric.js";

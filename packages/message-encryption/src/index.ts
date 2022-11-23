import {
  DecodedMessage as DecodedMessageV0,
  proto,
} from "@waku/core/lib/waku_message/version_0";
import type { DecodedMessage as IDecodedMessage } from "@waku/interfaces";

import {
  generatePrivateKey,
  generateSymmetricKey,
  getPublicKey,
} from "./crypto/index.js";

export const OneMillion = BigInt(1_000_000);

export { generatePrivateKey, generateSymmetricKey, getPublicKey };

export const Version = 1;

export type Signature = {
  signature: Uint8Array;
  publicKey: Uint8Array | undefined;
};

export class DecodedMessage
  extends DecodedMessageV0
  implements IDecodedMessage
{
  private readonly _decodedPayload: Uint8Array;

  constructor(
    proto: proto.WakuMessage,
    decodedPayload: Uint8Array,
    public signature?: Uint8Array,
    public signaturePublicKey?: Uint8Array
  ) {
    super(proto);
    this._decodedPayload = decodedPayload;
  }

  get payload(): Uint8Array {
    return this._decodedPayload;
  }
}

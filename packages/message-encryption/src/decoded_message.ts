import {
  DecodedMessage as DecodedMessageV0,
  proto
} from "@waku/core/lib/message/version_0";
import type { IDecodedMessage } from "@waku/interfaces";

export class DecodedMessage
  extends DecodedMessageV0
  implements IDecodedMessage
{
  private readonly _decodedPayload: Uint8Array;

  constructor(
    pubsubTopic: string,
    proto: proto.WakuMessage,
    decodedPayload: Uint8Array,
    public signature?: Uint8Array,
    public signaturePublicKey?: Uint8Array
  ) {
    super(pubsubTopic, proto);
    this._decodedPayload = decodedPayload;
  }

  get payload(): Uint8Array {
    return this._decodedPayload;
  }
}

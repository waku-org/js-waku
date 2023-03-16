import { DecodedMessage as DecodedMessageV0 } from "@waku/core/lib/message/version_0";
import type { IDecodedMessage } from "@waku/interfaces";
import { WakuMessage } from "@waku/proto";

export class DecodedMessage
  extends DecodedMessageV0
  implements IDecodedMessage
{
  private readonly _decodedPayload: Uint8Array;

  constructor(
    pubSubTopic: string,
    proto: WakuMessage,
    decodedPayload: Uint8Array,
    public signature?: Uint8Array,
    public signaturePublicKey?: Uint8Array
  ) {
    super(pubSubTopic, proto);
    this._decodedPayload = decodedPayload;
  }

  get payload(): Uint8Array {
    return this._decodedPayload;
  }
}

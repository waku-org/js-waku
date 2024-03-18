import type {
  IDecodedMessage,
  IMessage,
  IRateLimitProof
} from "@waku/interfaces";
import * as utils from "@waku/utils/bytes";

import { RLNInstance } from "./rln.js";
import { epochBytesToInt } from "./utils/index.js";

export function toRLNSignal(contentTopic: string, msg: IMessage): Uint8Array {
  const contentTopicBytes = utils.utf8ToBytes(contentTopic ?? "");
  return new Uint8Array([...(msg.payload ?? []), ...contentTopicBytes]);
}

export class RlnMessage<T extends IDecodedMessage> implements IDecodedMessage {
  public pubsubTopic = "";

  constructor(
    public rlnInstance: RLNInstance,
    public msg: T,
    public rateLimitProof: IRateLimitProof | undefined
  ) {}

  public verify(roots: Uint8Array[]): boolean | undefined {
    return this.rateLimitProof
      ? this.rlnInstance.zerokit.verifyWithRoots(
          this.rateLimitProof,
          toRLNSignal(this.msg.contentTopic, this.msg),
          ...roots
        ) // this.rlnInstance.verifyRLNProof once issue status-im/nwaku#1248 is fixed
      : undefined;
  }

  public verifyNoRoot(): boolean | undefined {
    return this.rateLimitProof
      ? this.rlnInstance.zerokit.verifyWithNoRoot(
          this.rateLimitProof,
          toRLNSignal(this.msg.contentTopic, this.msg)
        ) // this.rlnInstance.verifyRLNProof once issue status-im/nwaku#1248 is fixed
      : undefined;
  }

  get payload(): Uint8Array {
    return this.msg.payload;
  }

  get contentTopic(): string {
    return this.msg.contentTopic;
  }

  get timestamp(): Date | undefined {
    return this.msg.timestamp;
  }

  get ephemeral(): boolean | undefined {
    return this.msg.ephemeral;
  }

  get meta(): Uint8Array | undefined {
    return this.msg.meta;
  }

  get epoch(): number | undefined {
    const bytes = this.msg.rateLimitProof?.epoch;
    if (!bytes) return;

    return epochBytesToInt(bytes);
  }
}

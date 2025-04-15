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

export class RlnMessage implements IDecodedMessage {
  public pubsubTopic = "";

  public constructor(
    public rlnInstance: RLNInstance,
    public msg: IDecodedMessage,
    public rateLimitProof: IRateLimitProof | undefined
  ) {}

  public verify(roots: Uint8Array[]): boolean | undefined {
    return this.rateLimitProof
      ? this.rlnInstance.zerokit.verifyWithRoots(
          this.rateLimitProof,
          toRLNSignal(this.msg.contentTopic, this.msg),
          roots
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

  public get payload(): Uint8Array {
    return this.msg.payload;
  }

  public get contentTopic(): string {
    return this.msg.contentTopic;
  }

  public get timestamp(): Date | undefined {
    return this.msg.timestamp;
  }

  public get ephemeral(): boolean | undefined {
    return this.msg.ephemeral;
  }

  public get meta(): Uint8Array | undefined {
    return this.msg.meta;
  }

  public get version(): number | undefined {
    return this.msg.version;
  }

  public get epoch(): number | undefined {
    const bytes = this.rateLimitProof?.epoch;
    if (!bytes) return undefined;

    return epochBytesToInt(bytes);
  }
}

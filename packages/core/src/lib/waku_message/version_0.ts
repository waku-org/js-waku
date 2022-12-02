import type {
  DecodedMessage,
  Decoder,
  Encoder,
  Message,
  ProtoMessage,
  RateLimitProof,
} from "@waku/interfaces";
import debug from "debug";

import * as proto from "../../proto/message.js";

const log = debug("waku:message:version-0");
const OneMillion = BigInt(1_000_000);

export const Version = 0;
export { proto };

export class MessageV0 implements DecodedMessage {
  constructor(protected proto: proto.WakuMessage) {}

  get _rawPayload(): Uint8Array | undefined {
    if (this.proto.payload) {
      return new Uint8Array(this.proto.payload);
    }
    return;
  }

  get ephemeral(): boolean {
    return Boolean(this.proto.ephemeral);
  }

  get payload(): Uint8Array | undefined {
    return this._rawPayload;
  }

  get contentTopic(): string | undefined {
    return this.proto.contentTopic;
  }

  get _rawTimestamp(): bigint | undefined {
    return this.proto.timestamp;
  }

  get timestamp(): Date | undefined {
    // In the case we receive a value that is bigger than JS's max number,
    // we catch the error and return undefined.
    try {
      if (this.proto.timestamp) {
        // nanoseconds 10^-9 to milliseconds 10^-3
        const timestamp = this.proto.timestamp / OneMillion;
        return new Date(Number(timestamp));
      }

      if (this.proto.timestampDeprecated) {
        return new Date(this.proto.timestampDeprecated * 1000);
      }
    } catch (e) {
      return;
    }
    return;
  }

  get version(): number {
    // https://github.com/status-im/js-waku/issues/921
    return this.proto.version ?? 0;
  }

  get rateLimitProof(): RateLimitProof | undefined {
    return this.proto.rateLimitProof;
  }
}

export class EncoderV0 implements Encoder {
  constructor(public contentTopic: string, public ephemeral: boolean = false) {}

  async toWire(message: Partial<Message>): Promise<Uint8Array> {
    return proto.WakuMessage.encode(await this.toProtoObj(message));
  }

  async toProtoObj(message: Partial<Message>): Promise<ProtoMessage> {
    const timestamp = message.timestamp ?? new Date();

    return {
      payload: message.payload,
      version: Version,
      contentTopic: this.contentTopic,
      timestamp: BigInt(timestamp.valueOf()) * OneMillion,
      rateLimitProof: message.rateLimitProof,
      ephemeral: this.ephemeral,
    };
  }
}

export class DecoderV0 implements Decoder<MessageV0> {
  constructor(public contentTopic: string, public ephemeral: boolean = false) {}

  fromWireToProtoObj(bytes: Uint8Array): Promise<ProtoMessage | undefined> {
    const protoMessage = proto.WakuMessage.decode(bytes);
    log("Message decoded", protoMessage);
    return Promise.resolve({
      payload: protoMessage.payload ?? undefined,
      contentTopic: protoMessage.contentTopic ?? undefined,
      version: protoMessage.version ?? undefined,
      timestamp: protoMessage.timestamp ?? undefined,
      rateLimitProof: protoMessage.rateLimitProof ?? undefined,
      ephemeral: protoMessage.ephemeral ?? false,
    });
  }

  async fromProtoObj(proto: ProtoMessage): Promise<MessageV0 | undefined> {
    // https://github.com/status-im/js-waku/issues/921
    if (proto.version === undefined) {
      proto.version = 0;
    }

    if (proto.version !== Version) {
      log(
        "Failed to decode due to incorrect version, expected:",
        Version,
        ", actual:",
        proto.version
      );
      return Promise.resolve(undefined);
    }

    return new MessageV0(proto);
  }
}

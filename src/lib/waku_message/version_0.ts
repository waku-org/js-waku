import debug from "debug";

import * as proto from "../../proto/message";
import { Decoder, Message, ProtoMessage } from "../interfaces";
import { Encoder } from "../interfaces";

const log = debug("waku:message:version-0");

const OneMillion = BigInt(1_000_000);
export const Version = 0;

export class MessageV0 implements Message {
  constructor(private proto: proto.WakuMessage) {}

  get _rawPayload(): Uint8Array | undefined {
    if (this.proto.payload) {
      return new Uint8Array(this.proto.payload);
    }
    return;
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
}

export class EncoderV0 implements Encoder {
  constructor(public contentTopic: string) {}

  async encode(message: Message): Promise<Uint8Array> {
    return proto.WakuMessage.encode(await this.encodeProto(message));
  }

  async encodeProto(message: Message): Promise<ProtoMessage> {
    const timestamp = message.timestamp ?? new Date();

    return {
      payload: message.payload,
      version: Version,
      contentTopic: message.contentTopic ?? this.contentTopic,
      timestamp: BigInt(timestamp.valueOf()) * OneMillion,
    };
  }
}

export class DecoderV0 implements Decoder {
  constructor(public contentTopic: string) {}

  decodeProto(bytes: Uint8Array): Promise<ProtoMessage | undefined> {
    const protoMessage = proto.WakuMessage.decode(bytes);
    log("Message decoded", protoMessage);
    return Promise.resolve(protoMessage);
  }

  async decode(proto: ProtoMessage): Promise<Message | undefined> {
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

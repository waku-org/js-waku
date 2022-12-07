import type {
  DecodedMessage as IDecodedMessage,
  Decoder as IDecoder,
  Encoder as IEncoder,
  Message,
  ProtoMessage,
  RateLimitProof,
} from "@waku/interfaces";
import { proto_message as proto } from "@waku/proto";
import debug from "debug";

const log = debug("waku:message:version-0");
const OneMillion = BigInt(1_000_000);

export const Version = 0;
export { proto };

export class DecodedMessage implements IDecodedMessage {
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

export class Encoder implements IEncoder {
  constructor(public contentTopic: string, public ephemeral: boolean = false) {}

  async toWire(message: Message): Promise<Uint8Array> {
    return proto.WakuMessage.encode(await this.toProtoObj(message));
  }

  async toProtoObj(message: Message): Promise<ProtoMessage> {
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

/**
 * Creates an encoder that encode messages without Waku level encryption or signature.
 *
 * An encoder is used to encode messages in the [`14/WAKU2-MESSAGE](https://rfc.vac.dev/spec/14/)
 * format to be sent over the Waku network. The resulting encoder can then be
 * pass to { @link @waku/interfaces.LightPush.push } or
 * { @link @waku/interfaces.Relay.send } to automatically encode outgoing
 * messages.
 *
 * @param contentTopic The content topic to set on outgoing messages.
 * @param ephemeral An optional flag to mark message as ephemeral, ie, not to be stored by Waku Store nodes.
 */
export function createEncoder(
  contentTopic: string,
  ephemeral = false
): Encoder {
  return new Encoder(contentTopic, ephemeral);
}

export class Decoder implements IDecoder<DecodedMessage> {
  constructor(public contentTopic: string) {}

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

  async fromProtoObj(proto: ProtoMessage): Promise<DecodedMessage | undefined> {
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

    return new DecodedMessage(proto);
  }
}

/**
 * Creates an decoder that decode messages without Waku level encryption.
 *
 * A decoder is used to decode messages from the [14/WAKU2-MESSAGE](https://rfc.vac.dev/spec/14/)
 * format when received from the Waku network. The resulting decoder can then be
 * pass to { @link @waku/interfaces.Filter.subscribe } or
 * { @link @waku/interfaces.Relay.subscribe } to automatically decode incoming
 * messages.
 *
 * @param contentTopic The resulting decoder will only decode messages with this content topic.
 */
export function createDecoder(contentTopic: string): Decoder {
  return new Decoder(contentTopic);
}

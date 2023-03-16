import { IMetaSetter } from "@waku/interfaces";
import type {
  EncoderOptions,
  IDecodedMessage,
  IDecoder,
  IEncoder,
  IMessage,
  IRateLimitProof,
} from "@waku/interfaces";
import { WakuMessage } from "@waku/proto";
import debug from "debug";

const log = debug("waku:message:version-0");
const OneMillion = BigInt(1_000_000);

export const Version = 0;

export class DecodedMessage implements IDecodedMessage {
  constructor(public pubSubTopic: string, protected proto: WakuMessage) {}

  get ephemeral(): boolean {
    return Boolean(this.proto.ephemeral);
  }

  get payload(): Uint8Array {
    return this.proto.payload;
  }

  get contentTopic(): string {
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
      return;
    } catch (e) {
      return;
    }
  }

  get meta(): Uint8Array | undefined {
    return this.proto.meta;
  }

  get version(): number {
    // https://rfc.vac.dev/spec/14/
    // > If omitted, the value SHOULD be interpreted as version 0.
    return this.proto.version ?? 0;
  }

  get rateLimitProof(): IRateLimitProof | undefined {
    return this.proto.rateLimitProof;
  }
}

export class Encoder implements IEncoder {
  constructor(
    public contentTopic: string,
    public ephemeral: boolean = false,
    public metaSetter?: IMetaSetter
  ) {}

  async toWire(message: IMessage): Promise<Uint8Array> {
    return new WakuMessage(await this.toProtoObj(message)).toBinary();
  }

  async toProtoObj(message: IMessage): Promise<WakuMessage> {
    const timestamp = message.timestamp ?? new Date();

    const protoMessageWithoutMeta = new WakuMessage({
      payload: message.payload,
      version: Version,
      contentTopic: this.contentTopic,
      timestamp: BigInt(timestamp.valueOf()) * OneMillion,
      meta: undefined,
      rateLimitProof: message.rateLimitProof,
      ephemeral: this.ephemeral,
    }) as WakuMessage & { meta: undefined };

    if (this.metaSetter) {
      const meta = this.metaSetter(protoMessageWithoutMeta);
      const protoMessageWithMeta = new WakuMessage({
        ...protoMessageWithoutMeta,
        meta,
      });
      return protoMessageWithMeta;
    }

    return protoMessageWithoutMeta;
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
 */
export function createEncoder({
  contentTopic,
  ephemeral,
  metaSetter,
}: EncoderOptions): Encoder {
  return new Encoder(contentTopic, ephemeral, metaSetter);
}

export class Decoder implements IDecoder<DecodedMessage> {
  constructor(public contentTopic: string) {}

  fromWireToProtoObj(bytes: Uint8Array): Promise<WakuMessage | undefined> {
    const protoMessage = WakuMessage.fromBinary(bytes);
    log("Message decoded", protoMessage);
    return Promise.resolve(protoMessage);
  }

  async fromProtoObj(
    pubSubTopic: string,
    proto: WakuMessage
  ): Promise<DecodedMessage | undefined> {
    // https://rfc.vac.dev/spec/14/
    // > If omitted, the value SHOULD be interpreted as version 0.
    if (proto.version ?? 0 !== Version) {
      log(
        "Failed to decode due to incorrect version, expected:",
        Version,
        ", actual:",
        proto.version
      );
      return Promise.resolve(undefined);
    }

    return new DecodedMessage(pubSubTopic, proto);
  }
}

/**
 * Creates a decoder that decode messages without Waku level encryption.
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

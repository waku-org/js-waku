import type {
  IDecodedMessage,
  IDecoder,
  IEncoder,
  IMessage,
  IMetaSetter,
  IProtoMessage,
  IRateLimitProof,
  IRoutingInfo
} from "@waku/interfaces";
import { proto_message as proto } from "@waku/proto";
import { Logger } from "@waku/utils";

const log = new Logger("message:version-0");
const OneMillion = BigInt(1_000_000);

export const Version = 0;
export { proto };

export class DecodedMessage implements IDecodedMessage {
  public constructor(
    public pubsubTopic: string,
    private proto: proto.WakuMessage
  ) {}

  public get ephemeral(): boolean {
    return Boolean(this.proto.ephemeral);
  }

  public get payload(): Uint8Array {
    return this.proto.payload;
  }

  public get contentTopic(): string {
    return this.proto.contentTopic;
  }

  public get timestamp(): Date | undefined {
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

  public get meta(): Uint8Array | undefined {
    return this.proto.meta;
  }

  public get version(): number {
    // https://rfc.vac.dev/spec/14/
    // > If omitted, the value SHOULD be interpreted as version 0.
    return this.proto.version ?? Version;
  }

  public get rateLimitProof(): IRateLimitProof | undefined {
    return this.proto.rateLimitProof;
  }
}

export type EncoderOptions = {
  /**
   * The routing information for messages to encode.
   */
  routingInfo: IRoutingInfo;
  /** The content topic to set on outgoing messages. */
  contentTopic: string;
  /**
   * An optional flag to mark message as ephemeral, i.e., not to be stored by Waku Store nodes.
   * @defaultValue `false`
   */
  ephemeral?: boolean;
  /**
   * A function called when encoding messages to set the meta field.
   * @param IProtoMessage The message encoded for wire, without the meta field.
   * If encryption is used, `metaSetter` only accesses _encrypted_ payload.
   */
  metaSetter?: IMetaSetter;
};

export class Encoder implements IEncoder {
  public constructor(
    public contentTopic: string,
    public ephemeral: boolean = false,
    public routingInfo: IRoutingInfo,
    public metaSetter?: IMetaSetter
  ) {
    if (!contentTopic || contentTopic === "") {
      throw new Error("Content topic must be specified");
    }
  }

  public async toWire(message: IMessage): Promise<Uint8Array> {
    return proto.WakuMessage.encode(await this.toProtoObj(message));
  }

  public async toProtoObj(message: IMessage): Promise<IProtoMessage> {
    const timestamp = message.timestamp ?? new Date();

    const protoMessage = {
      payload: message.payload,
      version: Version,
      contentTopic: this.contentTopic,
      timestamp: BigInt(timestamp.valueOf()) * OneMillion,
      meta: undefined,
      rateLimitProof: message.rateLimitProof,
      ephemeral: this.ephemeral
    };

    if (this.metaSetter) {
      const meta = this.metaSetter(protoMessage);
      return { ...protoMessage, meta };
    }

    return protoMessage;
  }
}

/**
 * Creates an encoder that encode messages without Waku level encryption or signature.
 *
 * An encoder is used to encode messages in the [14/WAKU2-MESSAGE](https://rfc.vac.dev/spec/14/)
 * format to be sent over the Waku network. The resulting encoder can then be
 * pass to { @link @waku/interfaces!ISender.send } to automatically encode outgoing
 * messages.
 *
 * Note that a routing info may be tied to a given content topic, this is not checked by the encoder.
 */
export function createEncoder({
  contentTopic,
  routingInfo,
  ephemeral,
  metaSetter
}: EncoderOptions): Encoder {
  return new Encoder(contentTopic, ephemeral, routingInfo, metaSetter);
}

export class Decoder implements IDecoder<IDecodedMessage> {
  public constructor(
    public contentTopic: string,
    public routingInfo: IRoutingInfo
  ) {
    if (!contentTopic || contentTopic === "") {
      throw new Error("Content topic must be specified");
    }
  }

  public fromWireToProtoObj(
    bytes: Uint8Array
  ): Promise<IProtoMessage | undefined> {
    const protoMessage = proto.WakuMessage.decode(bytes);
    return Promise.resolve({
      payload: protoMessage.payload,
      contentTopic: protoMessage.contentTopic,
      version: protoMessage.version ?? undefined,
      timestamp: protoMessage.timestamp ?? undefined,
      meta: protoMessage.meta ?? undefined,
      rateLimitProof: protoMessage.rateLimitProof ?? undefined,
      ephemeral: protoMessage.ephemeral ?? false
    });
  }

  public async fromProtoObj(
    pubsubTopic: string,
    proto: IProtoMessage
  ): Promise<IDecodedMessage | undefined> {
    // https://rfc.vac.dev/spec/14/
    // > If omitted, the value SHOULD be interpreted as version 0.
    if (proto.version ?? 0 !== Version) {
      log.error(
        "Failed to decode due to incorrect version, expected:",
        Version,
        ", actual:",
        proto.version
      );
      return Promise.resolve(undefined);
    }

    return new DecodedMessage(pubsubTopic, proto);
  }
}

/**
 * Creates a decoder that decode messages without Waku level encryption.
 *
 * A decoder is used to decode messages from the [14/WAKU2-MESSAGE](https://rfc.vac.dev/spec/14/)
 * format when received from the Waku network. The resulting decoder can then be
 * pass to { @link @waku/interfaces!IReceiver.subscribe } to automatically decode incoming
 * messages.
 *
 * @param contentTopic The resulting decoder will only decode messages with this content topic.
 * @param routingInfo Routing information such as cluster id and shard id on which the message is expected to be received.
 *
 * Note that a routing info may be tied to a given content topic, this is not checked by the encoder.
 */
export function createDecoder(
  contentTopic: string,
  routingInfo: IRoutingInfo
): Decoder {
  return new Decoder(contentTopic, routingInfo);
}

import type {
  ICodec,
  IDecodedMessage,
  IDecoder,
  IEncoder,
  IMessage,
  IMetaSetter,
  IProtoMessage,
  IRoutingInfo,
  PubsubTopic
} from "@waku/interfaces";

import { Decoder, Encoder } from "./version_0.js";

export class Codec implements ICodec<IDecodedMessage> {
  private encoder: IEncoder;
  private decoder: IDecoder<IDecodedMessage>;

  public constructor(
    public contentTopic: string,
    public ephemeral: boolean = false,
    public routingInfo: IRoutingInfo,
    public metaSetter?: IMetaSetter
  ) {
    this.encoder = new Encoder(
      contentTopic,
      ephemeral,
      routingInfo,
      metaSetter
    );
    this.decoder = new Decoder(contentTopic, routingInfo);
  }

  public get pubsubTopic(): PubsubTopic {
    return this.routingInfo.pubsubTopic;
  }

  public async toWire(message: IMessage): Promise<Uint8Array | undefined> {
    return this.encoder.toWire(message);
  }

  public async toProtoObj(
    message: IMessage
  ): Promise<IProtoMessage | undefined> {
    return this.encoder.toProtoObj(message);
  }

  public fromWireToProtoObj(
    bytes: Uint8Array
  ): Promise<IProtoMessage | undefined> {
    return this.decoder.fromWireToProtoObj(bytes);
  }

  public async fromProtoObj(
    pubsubTopic: string,
    proto: IProtoMessage
  ): Promise<IDecodedMessage | undefined> {
    return this.decoder.fromProtoObj(pubsubTopic, proto);
  }
}

type CodecParams = {
  contentTopic: string;
  ephemeral: boolean;
  routingInfo: IRoutingInfo;
  metaSetter?: IMetaSetter;
};

export function createCodec(params: CodecParams): Codec {
  return new Codec(
    params.contentTopic,
    params.ephemeral,
    params.routingInfo,
    params.metaSetter
  );
}

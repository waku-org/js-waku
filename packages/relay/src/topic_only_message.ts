import type {
  IDecoder,
  IProtoMessage,
  IRoutingInfo,
  ITopicOnlyMessage,
  PubsubTopic
} from "@waku/interfaces";
import { TopicOnlyMessage as ProtoTopicOnlyMessage } from "@waku/proto";

export class TopicOnlyMessage implements ITopicOnlyMessage {
  public get version(): number {
    throw "Only content topic can be accessed on this message";
  }
  public get payload(): Uint8Array {
    throw "Only content topic can be accessed on this message";
  }
  public get hash(): Uint8Array {
    throw "Only content topic can be accessed on this message";
  }
  public get hashStr(): string {
    throw "Only content topic can be accessed on this message";
  }
  public rateLimitProof: undefined;
  public timestamp: undefined;
  public meta: undefined;
  public ephemeral: undefined;

  public constructor(
    public pubsubTopic: string,
    private proto: ProtoTopicOnlyMessage
  ) {}

  public get contentTopic(): string {
    return this.proto.contentTopic;
  }
}

// This decoder is used only for reading `contentTopic` from the WakuMessage
export class ContentTopicOnlyDecoder implements IDecoder<ITopicOnlyMessage> {
  public constructor() {}

  public get pubsubTopic(): PubsubTopic {
    throw "Pubsub Topic is not available on this decoder, it is only meant to decode the content topic for any message";
  }

  public get contentTopic(): string {
    throw "ContentTopic is not available on this decoder, it is only meant to decode the content topic for any message";
  }

  public get routingInfo(): IRoutingInfo {
    throw "RoutingInfo is not available on this decoder, it is only meant to decode the content topic for any message";
  }

  public fromWireToProtoObj(
    bytes: Uint8Array
  ): Promise<IProtoMessage | undefined> {
    const protoMessage = ProtoTopicOnlyMessage.decode(bytes);
    return Promise.resolve({
      contentTopic: protoMessage.contentTopic,
      payload: new Uint8Array(),
      rateLimitProof: undefined,
      timestamp: undefined,
      meta: undefined,
      version: undefined,
      ephemeral: undefined
    });
  }

  public async fromProtoObj(
    pubsubTopic: string,
    proto: IProtoMessage
  ): Promise<ITopicOnlyMessage | undefined> {
    return new TopicOnlyMessage(pubsubTopic, proto);
  }
}

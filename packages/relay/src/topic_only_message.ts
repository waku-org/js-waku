import type {
  IDecoder,
  IProtoMessage,
  ITopicOnlyMessage,
  PubsubTopic
} from "@waku/interfaces";
import { TopicOnlyMessage as ProtoTopicOnlyMessage } from "@waku/proto";

export class TopicOnlyMessage implements ITopicOnlyMessage {
  public payload: Uint8Array = new Uint8Array();
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
export class TopicOnlyDecoder implements IDecoder<ITopicOnlyMessage> {
  public contentTopic = "";

  // pubsubTopic is ignored
  public constructor(public pubsubTopic: PubsubTopic) {}

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

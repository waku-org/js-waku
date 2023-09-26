import type {
  IDecodedMessage,
  IDecoder,
  IProtoMessage
} from "@waku/interfaces";
import { TopicOnlyMessage as ProtoTopicOnlyMessage } from "@waku/proto";
import debug from "debug";

const log = debug("waku:message:topic-only");

export class TopicOnlyMessage implements IDecodedMessage {
  public payload: Uint8Array = new Uint8Array();
  public rateLimitProof: undefined;
  public timestamp: undefined;
  public meta: undefined;
  public ephemeral: undefined;

  constructor(
    public pubSubTopic: string,
    private proto: ProtoTopicOnlyMessage
  ) {}

  get contentTopic(): string {
    return this.proto.contentTopic;
  }
}

export class TopicOnlyDecoder implements IDecoder<TopicOnlyMessage> {
  public contentTopic = "";

  fromWireToProtoObj(bytes: Uint8Array): Promise<IProtoMessage | undefined> {
    const protoMessage = ProtoTopicOnlyMessage.decode(bytes);
    log("Message decoded", protoMessage);
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

  async fromProtoObj(
    pubSubTopic: string,
    proto: IProtoMessage
  ): Promise<TopicOnlyMessage | undefined> {
    return new TopicOnlyMessage(pubSubTopic, proto);
  }
}

import type { IDecodedMessage, IDecoder } from "@waku/interfaces";
import { proto_topic_only_message, WakuMessage } from "@waku/proto";
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
    private proto: proto_topic_only_message.TopicOnlyMessage
  ) {}

  get contentTopic(): string {
    return this.proto.contentTopic;
  }
}

export class TopicOnlyDecoder implements IDecoder<TopicOnlyMessage> {
  public contentTopic = "";

  fromWireToProtoObj(bytes: Uint8Array): Promise<WakuMessage | undefined> {
    const protoMessage =
      proto_topic_only_message.TopicOnlyMessage.fromBinary(bytes);
    log("Message decoded", protoMessage);

    return Promise.resolve(
      new WakuMessage({
        ...protoMessage,
        payload: new Uint8Array(),
        rateLimitProof: undefined,
        timestamp: undefined,
        meta: undefined,
        version: undefined,
        ephemeral: undefined,
      })
    );
  }

  async fromProtoObj(
    pubSubTopic: string,
    proto: WakuMessage
  ): Promise<TopicOnlyMessage | undefined> {
    return new TopicOnlyMessage(pubSubTopic, proto);
  }
}

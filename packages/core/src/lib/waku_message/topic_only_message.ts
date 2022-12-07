import type { DecodedMessage, Decoder, ProtoMessage } from "@waku/interfaces";
import { proto_topic_only_message as proto } from "@waku/proto";
import debug from "debug";

const log = debug("waku:message:topic-only");

export class TopicOnlyMessage implements DecodedMessage {
  public payload: undefined;
  public rateLimitProof: undefined;
  public timestamp: undefined;
  public ephemeral: undefined;

  constructor(private proto: proto.TopicOnlyMessage) {}

  get contentTopic(): string {
    return this.proto.contentTopic ?? "";
  }
}

export class TopicOnlyDecoder implements Decoder<TopicOnlyMessage> {
  public contentTopic = "";

  fromWireToProtoObj(bytes: Uint8Array): Promise<ProtoMessage | undefined> {
    const protoMessage = proto.TopicOnlyMessage.decode(bytes);
    log("Message decoded", protoMessage);
    return Promise.resolve({
      contentTopic: protoMessage.contentTopic,
      payload: undefined,
      rateLimitProof: undefined,
      timestamp: undefined,
      version: undefined,
      ephemeral: undefined,
    });
  }

  async fromProtoObj(
    proto: ProtoMessage
  ): Promise<TopicOnlyMessage | undefined> {
    return new TopicOnlyMessage(proto);
  }
}

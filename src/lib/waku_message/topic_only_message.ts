import debug from "debug";

import * as proto from "../../proto/topic_only_message";
import type { Decoder, Message, ProtoMessage } from "../interfaces";

const log = debug("waku:message:topic-only");

export class TopicOnlyMessage implements Message {
  constructor(private proto: proto.TopicOnlyMessage) {}

  get contentTopic(): string {
    return this.proto.contentTopic ?? "";
  }
}

export class TopicOnlyDecoder implements Decoder<TopicOnlyMessage> {
  public contentTopic = "";

  decodeProto(bytes: Uint8Array): Promise<ProtoMessage | undefined> {
    const protoMessage = proto.TopicOnlyMessage.decode(bytes);
    log("Message decoded", protoMessage);
    return Promise.resolve(protoMessage);
  }

  async decode(proto: ProtoMessage): Promise<TopicOnlyMessage | undefined> {
    return new TopicOnlyMessage(proto);
  }
}

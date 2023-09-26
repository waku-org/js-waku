import type { PeerId } from "@libp2p/interface/peer-id";
import type { Message } from "@libp2p/interface/pubsub";
import { TopicValidatorResult } from "@libp2p/interface/pubsub";
import { proto_message as proto } from "@waku/proto";
import debug from "debug";

const log = debug("waku:relay");

export function messageValidator(
  peer: PeerId,
  message: Message
): TopicValidatorResult {
  const startTime = performance.now();
  log(`validating message from ${peer} received on ${message.topic}`);
  let result = TopicValidatorResult.Accept;

  try {
    const protoMessage = proto.WakuMessage.decode(message.data);

    if (
      !protoMessage.contentTopic ||
      !protoMessage.contentTopic.length ||
      !protoMessage.payload ||
      !protoMessage.payload.length
    ) {
      result = TopicValidatorResult.Reject;
    }
  } catch (e) {
    result = TopicValidatorResult.Reject;
  }

  const endTime = performance.now();
  log(`Validation time (must be <100ms): ${endTime - startTime}ms`);
  return result;
}

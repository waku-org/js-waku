import type { Message, PeerId } from "@libp2p/interface";
import { TopicValidatorResult } from "@libp2p/interface";
import { protoMessage as proto } from "@waku/proto";
import { Logger } from "@waku/utils";

const log = new Logger("relay");

export function messageValidator(
  peer: PeerId,
  message: Message
): TopicValidatorResult {
  const startTime = performance.now();
  log.info(`validating message from ${peer} received on ${message.topic}`);
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

  const timeTakenMs = endTime - startTime;

  if (timeTakenMs > 100) {
    log.warn(
      `message validation took ${timeTakenMs}ms for peer ${peer} on topic ${message.topic}. This should be less than 100ms.`
    );
  } else {
    log.info(
      `message validation took ${timeTakenMs}ms for peer ${peer} on topic ${message.topic}`
    );
  }

  return result;
}

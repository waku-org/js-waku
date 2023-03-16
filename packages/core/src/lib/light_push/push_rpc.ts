import { proto_lightpush as proto, proto_message } from "@waku/proto";
import { v4 as uuid } from "uuid";

export function createRequest(
  message: proto_message.WakuMessage,
  pubSubTopic: string
): proto.PushRpc {
  const request = new proto.PushRequest({
    message,
    pubsubTopic: pubSubTopic,
  });
  return new proto.PushRpc({
    requestId: uuid(),
    request,
  });
}

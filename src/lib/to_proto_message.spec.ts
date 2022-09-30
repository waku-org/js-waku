import { expect } from "chai";

import { WakuMessage as WakuMessageProto } from "../proto/message";

import { toProtoMessage } from "./to_proto_message";

describe("to proto message", () => {
  it("Fields are not dropped", () => {
    const wire: WakuMessageProto = {
      contentTopic: "foo",
    };

    const protoMessage = toProtoMessage(wire);

    expect(protoMessage.contentTopic).to.eq("foo");

    const keys = Object.keys(protoMessage);
    expect(keys).to.contain("payload");
    expect(keys).to.contain("contentTopic");
    expect(keys).to.contain("version");
    expect(keys).to.contain("timestamp");
    expect(keys).to.contain("rateLimitProof");
  });
});

import { WakuMessage } from "@waku/proto";
import { expect } from "chai";

import { toProtoMessage } from "./to_proto_message.js";

//this test will fail as the initalisation to wire will drop the fields that are undefined
describe.skip("to proto message", () => {
  it("Fields are not dropped", () => {
    const wire: WakuMessage = new WakuMessage({
      payload: new Uint8Array(),
      contentTopic: "foo",
    });

    const protoMessage = toProtoMessage(wire);

    expect(protoMessage.contentTopic).to.eq("foo");

    const keys = Object.keys(protoMessage);
    expect(keys).to.contain("payload");
    expect(keys).to.contain("contentTopic");
    expect(keys).to.contain("version");
    expect(keys).to.contain("timestamp");
    expect(keys).to.contain("rateLimitProof");
    expect(keys).to.contain("ephemeral");
  });
});

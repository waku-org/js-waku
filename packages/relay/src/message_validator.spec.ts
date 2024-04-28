import { TopicValidatorResult } from "@libp2p/interface";
import type { UnsignedMessage } from "@libp2p/interface";
import { createSecp256k1PeerId } from "@libp2p/peer-id-factory";
import { createEncoder } from "@waku/core";
import { determinePubsubTopic } from "@waku/utils";
import { expect } from "chai";
import fc from "fast-check";

import { messageValidator } from "./message_validator.js";

const TestContentTopic = "/app/1/topic/utf8";
const TestPubsubTopic = determinePubsubTopic(TestContentTopic);

describe("Message Validator", () => {
  it("Accepts a valid Waku Message", async () => {
    await fc.assert(
      fc.asyncProperty(fc.uint8Array({ minLength: 1 }), async (payload) => {
        const peerId = await createSecp256k1PeerId();

        const encoder = createEncoder({
          contentTopic: TestContentTopic,
          pubsubTopic: TestPubsubTopic
        });
        const bytes = await encoder.toWire({ payload });

        const message: UnsignedMessage = {
          type: "unsigned",
          topic: TestPubsubTopic,
          data: bytes
        };

        const result = messageValidator(peerId, message);

        expect(result).to.eq(TopicValidatorResult.Accept);
      })
    );
  });

  it("Rejects garbage", async () => {
    await fc.assert(
      fc.asyncProperty(fc.uint8Array(), async (data) => {
        const peerId = await createSecp256k1PeerId();

        const message: UnsignedMessage = {
          type: "unsigned",
          topic: TestPubsubTopic,
          data
        };

        const result = messageValidator(peerId, message);

        expect(result).to.eq(TopicValidatorResult.Reject);
      })
    );
  });
});

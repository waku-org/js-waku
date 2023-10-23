import { TopicValidatorResult } from "@libp2p/interface/pubsub";
import type { UnsignedMessage } from "@libp2p/interface/pubsub";
import { createSecp256k1PeerId } from "@libp2p/peer-id-factory";
import { createEncoder } from "@waku/core";
import { expect } from "chai";
import fc from "fast-check";

import { messageValidator } from "./message_validator.js";

describe("Message Validator", () => {
  it("Accepts a valid Waku Message", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uint8Array({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        async (payload, pubsubTopic, contentTopic) => {
          const peerId = await createSecp256k1PeerId();

          const encoder = createEncoder({ contentTopic });
          const bytes = await encoder.toWire({ payload });

          const message: UnsignedMessage = {
            type: "unsigned",
            topic: pubsubTopic,
            data: bytes
          };

          const result = messageValidator(peerId, message);

          expect(result).to.eq(TopicValidatorResult.Accept);
        }
      )
    );
  });

  it("Rejects garbage", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uint8Array(),
        fc.string(),
        async (data, pubsubTopic) => {
          const peerId = await createSecp256k1PeerId();

          const message: UnsignedMessage = {
            type: "unsigned",
            topic: pubsubTopic,
            data
          };

          const result = messageValidator(peerId, message);

          expect(result).to.eq(TopicValidatorResult.Reject);
        }
      )
    );
  });
});

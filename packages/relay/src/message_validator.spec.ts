import { generateKeyPair } from "@libp2p/crypto/keys";
import { TopicValidatorResult } from "@libp2p/interface";
import type { UnsignedMessage } from "@libp2p/interface";
import { peerIdFromPrivateKey } from "@libp2p/peer-id";
import { createEncoder } from "@waku/core";
import { createRoutingInfo } from "@waku/utils";
import { expect } from "chai";
import fc from "fast-check";

import { messageValidator } from "./message_validator.js";

const testContentTopic = "/app/1/topic/utf8";
const testRoutingInfo = createRoutingInfo(
  {
    clusterId: 0,
    numShardsInCluster: 8
  },
  { contentTopic: testContentTopic }
);
const testPubsubTopic = testRoutingInfo.pubsubTopic;

describe("Message Validator", () => {
  it("Accepts a valid Waku Message", async () => {
    await fc.assert(
      fc.asyncProperty(fc.uint8Array({ minLength: 1 }), async (payload) => {
        const privateKey = await generateKeyPair("secp256k1");
        const peerId = peerIdFromPrivateKey(privateKey);

        const encoder = createEncoder({
          contentTopic: testContentTopic,
          routingInfo: testRoutingInfo
        });
        const bytes = await encoder.toWire({ payload });

        const message: UnsignedMessage = {
          type: "unsigned",
          topic: testPubsubTopic,
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
        const peerId =
          await generateKeyPair("secp256k1").then(peerIdFromPrivateKey);

        const message: UnsignedMessage = {
          type: "unsigned",
          topic: testPubsubTopic,
          data
        };

        const result = messageValidator(peerId, message);

        expect(result).to.eq(TopicValidatorResult.Reject);
      })
    );
  });
});

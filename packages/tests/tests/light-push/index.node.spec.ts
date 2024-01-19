import { createEncoder } from "@waku/core";
import {
  DefaultPubsubTopic,
  IRateLimitProof,
  LightNode,
  SendError
} from "@waku/interfaces";
import { utf8ToBytes } from "@waku/sdk";
import { expect } from "chai";

import { generateRandomUint8Array, ServiceNodes, TEST_STRING } from "../../src";
import {
  runMultipleNodes,
  teardownNodesWithRedundancy
} from "../filter/utils.js";

import {
  messagePayload,
  messageText,
  TestContentTopic,
  TestEncoder
} from "./utils";

const runTests = (strictNodeCheck: boolean): void => {
  const numServiceNodes = 3;
  describe(`Waku Light Push: Multiple Nodes: Strict Check: ${strictNodeCheck}`, function () {
    // Set the timeout for all tests in this suite. Can be overwritten at test level
    this.timeout(15000);
    let waku: LightNode;
    let serviceNodes: ServiceNodes;

    this.beforeEach(async function () {
      this.timeout(15000);
      [serviceNodes, waku] = await runMultipleNodes(
        this,
        [DefaultPubsubTopic],
        strictNodeCheck,
        undefined,
        numServiceNodes,
        true
      );
    });

    this.afterEach(async function () {
      this.timeout(15000);
      await teardownNodesWithRedundancy(serviceNodes, waku);
    });

    TEST_STRING.forEach((testItem) => {
      it(`Push message with ${testItem.description} payload`, async function () {
        const pushResponse = await waku.lightPush.send(TestEncoder, {
          payload: utf8ToBytes(testItem.value)
        });
        expect(pushResponse.recipients.length).to.eq(numServiceNodes);

        expect(await serviceNodes.messageCollector.waitForMessages(1)).to.eq(
          true
        );
        serviceNodes.messageCollector.verifyReceivedMessage(0, {
          expectedMessageText: testItem.value,
          expectedContentTopic: TestContentTopic
        });
      });
    });

    it("Push 30 different messages", async function () {
      const generateMessageText = (index: number): string => `M${index}`;

      for (let i = 0; i < 30; i++) {
        const pushResponse = await waku.lightPush.send(TestEncoder, {
          payload: utf8ToBytes(generateMessageText(i))
        });
        expect(pushResponse.recipients.length).to.eq(numServiceNodes);
      }

      expect(await serviceNodes.messageCollector.waitForMessages(30)).to.eq(
        true
      );

      for (let i = 0; i < 30; i++) {
        serviceNodes.messageCollector.verifyReceivedMessage(i, {
          expectedMessageText: generateMessageText(i),
          expectedContentTopic: TestContentTopic
        });
      }
    });

    it("Throws when trying to push message with empty payload", async function () {
      const pushResponse = await waku.lightPush.send(TestEncoder, {
        payload: new Uint8Array()
      });

      expect(pushResponse.recipients.length).to.eq(0);
      console.log("validated 1");
      expect(pushResponse.errors).to.include(SendError.EMPTY_PAYLOAD);
      console.log("validated 2");
      expect(await serviceNodes.messageCollector.waitForMessages(1)).to.eq(
        false
      );
      console.log("validated 3");
    });

    TEST_STRING.forEach((testItem) => {
      it(`Push message with content topic containing ${testItem.description}`, async function () {
        const customEncoder = createEncoder({
          contentTopic: testItem.value
        });
        const pushResponse = await waku.lightPush.send(
          customEncoder,
          messagePayload
        );
        expect(pushResponse.recipients.length).to.eq(numServiceNodes);

        expect(await serviceNodes.messageCollector.waitForMessages(1)).to.eq(
          true
        );
        serviceNodes.messageCollector.verifyReceivedMessage(0, {
          expectedMessageText: messageText,
          expectedContentTopic: testItem.value
        });
      });
    });

    it("Fails to push message with empty content topic", async function () {
      try {
        createEncoder({ contentTopic: "" });
        expect.fail("Expected an error but didn't get one");
      } catch (error) {
        expect((error as Error).message).to.equal(
          "Content topic must be specified"
        );
      }
    });

    it("Push message with meta", async function () {
      const customTestEncoder = createEncoder({
        contentTopic: TestContentTopic,
        metaSetter: () => new Uint8Array(10)
      });

      const pushResponse = await waku.lightPush.send(
        customTestEncoder,
        messagePayload
      );
      expect(pushResponse.recipients.length).to.eq(numServiceNodes);

      expect(await serviceNodes.messageCollector.waitForMessages(1)).to.eq(
        true
      );
      serviceNodes.messageCollector.verifyReceivedMessage(0, {
        expectedMessageText: messageText,
        expectedContentTopic: TestContentTopic
      });
    });

    it("Fails to push message with large meta", async function () {
      const customTestEncoder = createEncoder({
        contentTopic: TestContentTopic,
        metaSetter: () => new Uint8Array(105024) // see the note below ***
      });

      // *** note: this test used 10 ** 6 when `nwaku` node had MaxWakuMessageSize == 1MiB ( 1*2^20 .)
      // `nwaku` establishes the max lightpush msg size as `const MaxRpcSize* = MaxWakuMessageSize + 64 * 1024`
      // see: https://github.com/waku-org/nwaku/blob/07beea02095035f4f4c234ec2dec1f365e6955b8/waku/waku_lightpush/rpc_codec.nim#L15
      // In the PR https://github.com/waku-org/nwaku/pull/2298 we reduced the MaxWakuMessageSize
      // from 1MiB to 150KiB. Therefore, the 105024 number comes from substracting ( 1*2^20 - 150*2^10 )
      // to the original 10^6 that this test had when MaxWakuMessageSize == 1*2^20

      const pushResponse = await waku.lightPush.send(
        customTestEncoder,
        messagePayload
      );

      if (serviceNodes.type == "go-waku") {
        expect(pushResponse.recipients.length).to.eq(numServiceNodes);
        expect(await serviceNodes.messageCollector.waitForMessages(1)).to.eq(
          true
        );
        serviceNodes.messageCollector.verifyReceivedMessage(0, {
          expectedMessageText: messageText,
          expectedContentTopic: TestContentTopic
        });
      } else {
        expect(pushResponse.recipients.length).to.eq(0);
        expect(pushResponse.errors).to.include(SendError.REMOTE_PEER_REJECTED);
        expect(await serviceNodes.messageCollector.waitForMessages(1)).to.eq(
          false
        );
      }
    });

    it("Push message with rate limit", async function () {
      const rateLimitProof: IRateLimitProof = {
        proof: utf8ToBytes("proofData"),
        merkleRoot: utf8ToBytes("merkleRootData"),
        epoch: utf8ToBytes("epochData"),
        shareX: utf8ToBytes("shareXData"),
        shareY: utf8ToBytes("shareYData"),
        nullifier: utf8ToBytes("nullifierData"),
        rlnIdentifier: utf8ToBytes("rlnIdentifierData")
      };

      const pushResponse = await waku.lightPush.send(TestEncoder, {
        payload: utf8ToBytes(messageText),
        rateLimitProof: rateLimitProof
      });
      expect(pushResponse.recipients.length).to.eq(numServiceNodes);

      expect(await serviceNodes.messageCollector.waitForMessages(1)).to.eq(
        true
      );
      serviceNodes.messageCollector.verifyReceivedMessage(0, {
        expectedMessageText: messageText,
        expectedContentTopic: TestContentTopic
      });
    });

    [
      Date.now() - 3600000 * 24 * 356,
      Date.now() - 3600000,
      Date.now() + 3600000
    ].forEach((testItem) => {
      it(`Push message with custom timestamp: ${testItem}`, async function () {
        const pushResponse = await waku.lightPush.send(TestEncoder, {
          payload: utf8ToBytes(messageText),
          timestamp: new Date(testItem)
        });
        expect(pushResponse.recipients.length).to.eq(numServiceNodes);

        expect(await serviceNodes.messageCollector.waitForMessages(1)).to.eq(
          true
        );
        serviceNodes.messageCollector.verifyReceivedMessage(0, {
          expectedMessageText: messageText,
          expectedTimestamp: testItem,
          expectedContentTopic: TestContentTopic
        });
      });
    });

    it("Push message equal or less that 1MB", async function () {
      const bigPayload = generateRandomUint8Array(65536);
      const pushResponse = await waku.lightPush.send(TestEncoder, {
        payload: bigPayload
      });
      expect(pushResponse.recipients.length).to.greaterThan(0);
    });

    it("Fails to push message bigger that 1MB", async function () {
      const MB = 1024 ** 2;

      const pushResponse = await waku.lightPush.send(TestEncoder, {
        payload: generateRandomUint8Array(MB + 65536)
      });
      expect(pushResponse.recipients.length).to.eq(0);
      expect(pushResponse.errors).to.include(SendError.SIZE_TOO_BIG);
      expect(await serviceNodes.messageCollector.waitForMessages(1)).to.eq(
        false
      );
    });
  });
};

[true].map(runTests);

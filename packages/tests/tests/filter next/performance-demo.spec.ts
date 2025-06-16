import { LightNode } from "@waku/interfaces";
import { utf8ToBytes } from "@waku/sdk";
import { expect } from "chai";

import {
  afterEachCustom,
  beforeEachCustom,
  ServiceNodesFleet,
  TEST_STRING
} from "../../src/index.js";

import {
  runMultipleNodes,
  teardownNodesWithRedundancy,
  TestContentTopic,
  TestDecoder,
  TestEncoder,
  TestPubsubTopic,
  TestShardInfo
} from "./utils.js";

describe("Filter Next Performance Comparison", function () {
  this.timeout(180000);

  describe("Original Approach - Individual Tests", function () {
    let waku: LightNode;
    let serviceNodes: ServiceNodesFleet;
    let startTime: number;

    before(function () {
      startTime = Date.now();
    });

    after(function () {
      const duration = Date.now() - startTime;
      console.log(`\nOriginal approach total time: ${duration}ms`);
    });

    beforeEachCustom(this, async () => {
      [serviceNodes, waku] = await runMultipleNodes(
        this.ctx,
        TestShardInfo,
        false,
        2
      );
    });

    afterEachCustom(this, async () => {
      await teardownNodesWithRedundancy(serviceNodes, waku);
    });

    // Run just 3 tests as example
    TEST_STRING.slice(0, 3).forEach((testItem) => {
      it(`Check message: ${testItem.description}`, async function () {
        await waku.nextFilter.subscribe(
          TestDecoder,
          serviceNodes.messageCollector.callback
        );

        await waku.lightPush.send(TestEncoder, {
          payload: utf8ToBytes(testItem.value)
        });

        expect(await serviceNodes.messageCollector.waitForMessages(1)).to.eq(
          true
        );
      });
    });
  });

  describe("Optimized Approach - Batched Test", function () {
    let waku: LightNode;
    let serviceNodes: ServiceNodesFleet;
    let startTime: number;

    before(async function () {
      startTime = Date.now();
      // Create infrastructure once
      [serviceNodes, waku] = await runMultipleNodes(
        this,
        TestShardInfo,
        false,
        2
      );
    });

    after(async function () {
      const duration = Date.now() - startTime;
      console.log(`\nOptimized approach total time: ${duration}ms`);
      await teardownNodesWithRedundancy(serviceNodes, waku);
    });

    it("Check all messages in one test", async function () {
      await waku.nextFilter.subscribe(
        TestDecoder,
        serviceNodes.messageCollector.callback
      );

      // Send all messages in parallel
      const sendPromises = TEST_STRING.slice(0, 3).map((testItem) =>
        waku.lightPush.send(TestEncoder, {
          payload: utf8ToBytes(testItem.value)
        })
      );

      await Promise.all(sendPromises);

      expect(await serviceNodes.messageCollector.waitForMessages(3)).to.eq(
        true
      );

      // Verify each message
      TEST_STRING.slice(0, 3).forEach((testItem, index) => {
        serviceNodes.messageCollector.verifyReceivedMessage(index, {
          expectedMessageText: testItem.value,
          expectedContentTopic: TestContentTopic,
          expectedPubsubTopic: TestPubsubTopic
        });
      });
    });
  });
});

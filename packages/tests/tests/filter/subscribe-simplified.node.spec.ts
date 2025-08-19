/**
 * Example of simplified filter test using the new centralized utilities
 * This demonstrates how the new system reduces boilerplate code
 */

import { LightNode } from "@waku/interfaces";
import {
  ecies,
  generatePrivateKey,
  getPublicKey
} from "@waku/message-encryption";
import { utf8ToBytes } from "@waku/sdk";
import { expect } from "chai";

import {
  afterEachCustom,
  beforeEachCustom,
  createTestSuiteDescription,
  createTestUtilities,
  runMultipleNodes,
  ServiceNodesFleet,
  teardownNodesWithRedundancy,
  testSingleMessage,
  testSubscription,
  verifyConnections
} from "../../src/index.js";

const runTests = (strictCheckNodes: boolean): void => {
  // Create test utilities once for the entire suite
  const utilities = createTestUtilities("filter");

  describe(
    createTestSuiteDescription(
      "Filter",
      "Subscribe",
      `Strict Check: ${strictCheckNodes}`
    ),
    function () {
      this.timeout(100000);
      let waku: LightNode;
      let serviceNodes: ServiceNodesFleet;

      beforeEachCustom(this, async () => {
        [serviceNodes, waku] = await runMultipleNodes(
          this.ctx,
          utilities.routingInfo,
          undefined,
          strictCheckNodes
        );
      });

      afterEachCustom(this, async () => {
        await teardownNodesWithRedundancy(serviceNodes, waku);
      });

      it("Subscribe and receive messages via lightPush", async function () {
        verifyConnections(waku, 2);

        // Use the common subscription test pattern
        await testSubscription({ serviceNodes, waku }, utilities);
      });

      it("Subscribe and receive encrypted messages via lightPush", async function () {
        const privateKey = generatePrivateKey();
        const publicKey = getPublicKey(privateKey);

        const encoder = ecies.createEncoder({
          contentTopic: utilities.config.contentTopic,
          publicKey,
          routingInfo: utilities.routingInfo
        });
        const decoder = ecies.createDecoder(
          utilities.config.contentTopic,
          utilities.routingInfo,
          privateKey
        );

        await waku.filter.subscribe(
          decoder,
          serviceNodes.messageCollector.callback
        );

        await waku.lightPush.send(encoder, utilities.messagePayload);

        expect(await serviceNodes.messageCollector.waitForMessages(1)).to.eq(
          true
        );
        serviceNodes.messageCollector.verifyReceivedMessage(0, {
          expectedMessageText: utilities.config.messageText,
          expectedContentTopic: utilities.config.contentTopic
        });
      });

      it("Subscribe and receive 2 messages on the same topic", async function () {
        await waku.filter.subscribe(
          utilities.decoder,
          serviceNodes.messageCollector.callback
        );

        // Use common pattern for first message
        await testSingleMessage({ serviceNodes, waku }, utilities);

        // Send second message with different text
        const newMessageText = "Filtering still works!";
        await waku.lightPush.send(utilities.encoder, {
          payload: utf8ToBytes(newMessageText)
        });

        expect(await serviceNodes.messageCollector.waitForMessages(2)).to.eq(
          true
        );
        serviceNodes.messageCollector.verifyReceivedMessage(1, {
          expectedMessageText: newMessageText,
          expectedContentTopic: utilities.config.contentTopic
        });
      });
    }
  );
};

// Run tests with both strict and non-strict modes
[true, false].map((strictCheckNodes) => runTests(strictCheckNodes));

import { IFilterSubscription, LightNode } from "@waku/interfaces";
import { utf8ToBytes } from "@waku/sdk";
import { expect } from "chai";

import {
  afterEachCustom,
  beforeEachCustom,
  ServiceNodesFleet
} from "../../src/index.js";

import {
  runMultipleNodes,
  teardownNodesWithRedundancy,
  TestContentTopic,
  TestDecoder,
  TestEncoder,
  TestShardInfo,
  validatePingError
} from "./utils";

const runTests = (strictCheckNodes: boolean): void => {
  describe.only(`Waku Filter V2: Ping: Multiple Nodes: Strict Checking: ${strictCheckNodes}`, function () {
    // Set the timeout for all tests in this suite. Can be overwritten at test level
    this.timeout(10000);
    let waku: LightNode;
    let serviceNodes: ServiceNodesFleet;
    let subscription: IFilterSubscription;

    beforeEachCustom(this, async () => {
      [serviceNodes, waku] = await runMultipleNodes(this.ctx, TestShardInfo);
      subscription = await waku.filter.createSubscription(TestShardInfo);
    });

    afterEachCustom(this, async () => {
      await teardownNodesWithRedundancy(serviceNodes, waku);
    });

    it("Ping on subscribed peer", async function () {
      await subscription.subscribe(
        [TestDecoder],
        serviceNodes.messageCollector.callback
      );
      await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M1") });
      expect(await serviceNodes.messageCollector.waitForMessages(1)).to.eq(
        true
      );

      // If ping is successfull(node has active subscription) we receive a success status code.
      await subscription.ping();

      await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M2") });

      // Confirm new messages are received after a ping.
      expect(await serviceNodes.messageCollector.waitForMessages(2)).to.eq(
        true
      );
    });

    it("Ping on peer without subscriptions", async function () {
      await validatePingError(subscription);
    });

    it("Ping on unsubscribed peer", async function () {
      await subscription.subscribe(
        [TestDecoder],
        serviceNodes.messageCollector.callback
      );
      await subscription.ping();
      await subscription.unsubscribe([TestContentTopic]);

      // Ping imediately after unsubscribe
      await validatePingError(subscription);
    });

    it("Reopen subscription with peer with lost subscription", async function () {
      const openSubscription = async (): Promise<void> => {
        await subscription.subscribe(
          [TestDecoder],
          serviceNodes.messageCollector.callback
        );
      };

      const unsubscribe = async (): Promise<void> => {
        await subscription.unsubscribe([TestContentTopic]);
      };

      const pingAndReinitiateSubscription = async (): Promise<void> => {
        try {
          await subscription.ping();
        } catch (error) {
          if (
            error instanceof Error &&
            error.message.includes("peer has no subscriptions")
          ) {
            await openSubscription();
          } else {
            throw error;
          }
        }
      };

      // open subscription & ping -> should pass
      await openSubscription();
      await pingAndReinitiateSubscription();

      // unsubscribe & ping -> should fail and reinitiate subscription
      await unsubscribe();
      await pingAndReinitiateSubscription();

      // ping -> should pass as subscription is reinitiated
      await pingAndReinitiateSubscription();
    });
  });
};

[true, false].map(runTests);

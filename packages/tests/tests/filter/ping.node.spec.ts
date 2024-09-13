import { ISubscriptionSDK, LightNode } from "@waku/interfaces";
import { utf8ToBytes } from "@waku/sdk";
import { expect } from "chai";

import {
  afterEachCustom,
  beforeEachCustom,
  runMultipleNodes,
  ServiceNodesFleet,
  teardownNodesWithRedundancy
} from "../../src/index.js";

import {
  TestContentTopic,
  TestDecoder,
  TestEncoder,
  TestShardInfo,
  validatePingError
} from "./utils.js";

const runTests = (strictCheckNodes: boolean): void => {
  describe(`Waku Filter V2: Ping: Multiple Nodes: Strict Checking: ${strictCheckNodes}`, function () {
    // Set the timeout for all tests in this suite. Can be overwritten at test level
    this.timeout(10000);
    let waku: LightNode;
    let serviceNodes: ServiceNodesFleet;

    beforeEachCustom(this, async () => {
      try {
        [serviceNodes, waku] = await runMultipleNodes(this.ctx, TestShardInfo);
      } catch (error) {
        console.error(error);
      }
    });

    afterEachCustom(this, async () => {
      await teardownNodesWithRedundancy(serviceNodes, waku);
    });

    it("Ping on subscribed peer", async function () {
      const { error, subscription } = await waku.filter.subscribe(
        [TestDecoder],
        serviceNodes.messageCollector.callback
      );
      if (error) {
        throw error;
      }
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
      const { subscription, error } = await waku.filter.subscribe(
        [TestDecoder],
        serviceNodes.messageCollector.callback
      );
      if (error) {
        throw error;
      }
      await subscription.unsubscribe([TestContentTopic]);
      await validatePingError(subscription);
    });

    it("Ping on unsubscribed peer", async function () {
      const { error, subscription } = await waku.filter.subscribe(
        [TestDecoder],
        serviceNodes.messageCollector.callback
      );
      if (error) {
        throw error;
      }
      await subscription.ping();
      await subscription.unsubscribe([TestContentTopic]);

      // Ping imediately after unsubscribe
      await validatePingError(subscription);
    });

    it("Reopen subscription with peer with lost subscription", async function () {
      let subscription: ISubscriptionSDK;
      const openSubscription = async (): Promise<void> => {
        const { error, subscription: _subscription } =
          await waku.filter.subscribe(
            [TestDecoder],
            serviceNodes.messageCollector.callback
          );
        if (error) {
          throw error;
        }
        subscription = _subscription;
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

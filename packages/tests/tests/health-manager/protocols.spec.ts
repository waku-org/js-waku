import {
  createDecoder,
  createEncoder,
  HealthStatus,
  type LightNode,
  Protocols,
  utf8ToBytes
} from "@waku/sdk";
import { contentTopicToPubsubTopic } from "@waku/utils";
import { expect } from "chai";

import { afterEachCustom, ServiceNodesFleet } from "../../src/index.js";
import {
  runMultipleNodes,
  teardownNodesWithRedundancy
} from "../filter/utils.js";

const NUM_NODES = [0, 1, 2, 3];

export const TestContentTopic = "/test/1/waku-filter/default";
export const ClusterId = 2;
export const TestShardInfo = {
  contentTopics: [TestContentTopic],
  clusterId: ClusterId
};
export const TestPubsubTopic = contentTopicToPubsubTopic(
  TestContentTopic,
  ClusterId
);
export const TestEncoder = createEncoder({
  contentTopic: TestContentTopic,
  pubsubTopic: TestPubsubTopic
});
export const TestDecoder = createDecoder(TestContentTopic, TestPubsubTopic);
export const messageText = "Filtering works!";
export const messagePayload = { payload: utf8ToBytes(messageText) };

describe("Health Manager", function () {
  this.timeout(15000);
  describe("Should update the health status for protocols", () => {
    let waku: LightNode;
    let serviceNodes: ServiceNodesFleet;

    afterEachCustom(this, async () => {
      await teardownNodesWithRedundancy(serviceNodes, waku);
    });

    NUM_NODES.map((num) => {
      it(`LightPush with ${num} connections`, async function () {
        [serviceNodes, waku] = await runMultipleNodes(
          this.ctx,
          TestShardInfo,
          undefined,
          num
        );

        await waku.lightPush.send(TestEncoder, messagePayload);

        const health = waku.health.getProtocolStatus(Protocols.LightPush);
        if (!health) {
          expect(health).to.not.equal(undefined);
        }

        if (num === 0) {
          expect(health?.status).to.equal(HealthStatus.Unhealthy);
        } else if (num < 2) {
          expect(health?.status).to.equal(HealthStatus.MinimallyHealthy);
        } else if (num >= 2) {
          expect(health?.status).to.equal(HealthStatus.SufficientlyHealthy);
        } else {
          throw new Error("Invalid number of connections");
        }
      });
      it(`Filter with ${num} connections`, async function () {
        [serviceNodes, waku] = await runMultipleNodes(
          this.ctx,
          TestShardInfo,
          undefined,
          num
        );

        const { error, subscription } =
          await waku.filter.createSubscription(TestShardInfo);
        if (error) {
          expect(error).to.not.equal(undefined);
        }

        await subscription?.subscribe([TestDecoder], () => {});

        const health = waku.health.getProtocolStatus(Protocols.Filter);
        if (!health) {
          expect(health).to.not.equal(undefined);
        }

        if (num === 0) {
          expect(health?.status).to.equal(HealthStatus.Unhealthy);
        } else if (num < 2) {
          expect(health?.status).to.equal(HealthStatus.MinimallyHealthy);
        } else if (num >= 2) {
          expect(health?.status).to.equal(HealthStatus.SufficientlyHealthy);
        } else {
          throw new Error("Invalid number of connections");
        }
      });
      //TODO: blocked by https://github.com/waku-org/js-waku/pull/2019
      it.skip(`Store with ${num} connections`, async function () {
        [serviceNodes, waku] = await runMultipleNodes(
          this.ctx,
          TestShardInfo,
          undefined,
          num
        );

        await waku.store.queryWithPromiseCallback([TestDecoder], () => {});

        const health = waku.health.getProtocolStatus(Protocols.Store);
        if (!health) {
          expect(health).to.not.equal(undefined);
        }

        if (num === 0) {
          expect(health?.status).to.equal(HealthStatus.Unhealthy);
        } else if (num < 2) {
          expect(health?.status).to.equal(HealthStatus.MinimallyHealthy);
        } else if (num >= 2) {
          expect(health?.status).to.equal(HealthStatus.SufficientlyHealthy);
        } else {
          throw new Error("Invalid number of connections");
        }
      });
    });
  });
});

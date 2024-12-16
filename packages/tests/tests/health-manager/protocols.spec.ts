import { HealthStatus, type LightNode, Protocols } from "@waku/sdk";
import { expect } from "chai";

import {
  afterEachCustom,
  runMultipleNodes,
  ServiceNodesFleet,
  teardownNodesWithRedundancy
} from "../../src/index.js";

import {
  createHealthEventPromise,
  messagePayload,
  TestDecoder,
  TestEncoder,
  TestShardInfo
} from "./utils.js";

const NUM_NODES = [0, 1, 2, 3];

// TODO(weboko): resolve https://github.com/waku-org/js-waku/issues/2186
describe.skip("Health Manager", function () {
  this.timeout(10_000);

  let waku: LightNode;
  let serviceNodes: ServiceNodesFleet;

  afterEachCustom(this, async () => {
    await teardownNodesWithRedundancy(serviceNodes, waku);
  });

  describe("Should update the health status for protocols", () => {
    this.timeout(10_000);

    NUM_NODES.map((num) => {
      it(`LightPush with ${num} connections`, async function () {
        this.timeout(10_000);
        [serviceNodes, waku] = await runMultipleNodes(
          this.ctx,
          TestShardInfo,
          { lightpush: true, filter: true },
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
          { filter: true, lightpush: true },
          undefined,
          num
        );

        const { error } = await waku.filter.subscribe([TestDecoder], () => {});

        if (error) {
          expect(error).to.not.equal(undefined);
        }

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
    });
  });

  describe.only("Health Manager Events", function () {
    this.timeout(10000);

    it("should emit protocol health events", async function () {
      [serviceNodes, waku] = await runMultipleNodes(
        this.ctx,
        TestShardInfo,
        { lightpush: true },
        undefined,
        2
      );

      const eventPromise = createHealthEventPromise(waku, "health:protocol");

      // Trigger a protocol health update
      await waku.lightPush.send(TestEncoder, messagePayload);

      const event = await eventPromise;
      expect(event.type).to.equal("health:protocol");
      expect(event.protocol).to.equal(Protocols.LightPush);
      expect(event.status).to.equal(HealthStatus.SufficientlyHealthy);
      expect(event.timestamp).to.be.instanceOf(Date);
    });

    it("should emit overall health events", async function () {
      [serviceNodes, waku] = await runMultipleNodes(
        this.ctx,
        TestShardInfo,
        { lightpush: true, filter: true },
        undefined,
        2
      );

      const eventPromise = createHealthEventPromise(waku, "health:overall");

      // Trigger health updates
      await waku.lightPush.send(TestEncoder, messagePayload);
      await waku.filter.subscribe([TestDecoder], () => {});

      const event = await eventPromise;
      expect(event.type).to.equal("health:overall");
      expect(event.status).to.equal(HealthStatus.SufficientlyHealthy);
      expect(event.timestamp).to.be.instanceOf(Date);
    });

    it("should allow multiple listeners for the same event type", async function () {
      [serviceNodes, waku] = await runMultipleNodes(
        this.ctx,
        TestShardInfo,
        { lightpush: true },
        undefined,
        1
      );

      let listener1Called = false;
      let listener2Called = false;

      waku.health.addEventListener("health:protocol", () => {
        listener1Called = true;
      });
      waku.health.addEventListener("health:protocol", () => {
        listener2Called = true;
      });

      await waku.lightPush.send(TestEncoder, messagePayload);

      // Give events time to propagate
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(listener1Called).to.be.true;
      expect(listener2Called).to.be.true;
    });

    it("should properly remove event listeners", async function () {
      [serviceNodes, waku] = await runMultipleNodes(
        this.ctx,
        TestShardInfo,
        { lightpush: true },
        undefined,
        1
      );
      let callCount = 0;
      const listener = (): void => {
        callCount++;
      };

      waku.health.addEventListener("health:protocol", listener);
      await waku.lightPush.send(TestEncoder, messagePayload);

      // Give first event time to propagate
      await new Promise((resolve) => setTimeout(resolve, 100));

      waku.health.removeEventListener("health:protocol", listener);
      await waku.lightPush.send(TestEncoder, messagePayload);

      // Give second event time to propagate
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(callCount).to.equal(1);
    });
  });
});

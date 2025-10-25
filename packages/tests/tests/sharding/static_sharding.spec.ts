import { LightNode, StaticSharding } from "@waku/interfaces";
import { createEncoder, utf8ToBytes } from "@waku/sdk";
import { createRoutingInfo } from "@waku/utils";
import { expect } from "chai";

import {
  afterEachCustom,
  runMultipleNodes,
  ServiceNodesFleet,
  teardownNodesWithRedundancy
} from "../../src/index.js";

const ContentTopic = "/waku/2/content/test.js";

describe("Static Sharding: Running Nodes", function () {
  this.timeout(15_000);
  const numServiceNodes = 2;

  let waku: LightNode | undefined = undefined;
  let serviceNodes: ServiceNodesFleet | undefined = undefined;

  afterEachCustom(this, async () => {
    if (serviceNodes) {
      await teardownNodesWithRedundancy(serviceNodes, waku ?? []);
    }
  });

  it("Cluster id 0, shard 0", async function () {
    const clusterId = 0;
    const shardId = 0;
    const networkConfig: StaticSharding = { clusterId };
    const routingInfo = createRoutingInfo(networkConfig, { shardId });

    [serviceNodes, waku] = await runMultipleNodes(
      this.ctx,
      routingInfo,
      { lightpush: true, filter: true },
      false,
      numServiceNodes,
      true
    );

    const encoder = createEncoder({
      contentTopic: ContentTopic,
      routingInfo
    });

    const request = await waku.lightPush.send(encoder, {
      payload: utf8ToBytes("Hello World")
    });

    expect(request.successes.length).to.eq(numServiceNodes);
    expect(await serviceNodes.messageCollector.waitForMessages(1)).to.eq(true);
  });

  // dedicated test for Default Cluster ID 0
  it("Cluster ID 0, shard 1", async function () {
    const clusterId = 0;
    const shardId = 1;
    const networkConfig: StaticSharding = { clusterId };
    const routingInfo = createRoutingInfo(networkConfig, { shardId });

    [serviceNodes, waku] = await runMultipleNodes(
      this.ctx,
      routingInfo,
      { lightpush: true, filter: true },
      false,
      numServiceNodes,
      true
    );

    const encoder = createEncoder({
      contentTopic: ContentTopic,
      routingInfo
    });

    const request = await waku.lightPush.send(encoder, {
      payload: utf8ToBytes("Hello World")
    });

    expect(request.successes.length).to.eq(numServiceNodes);
    expect(await serviceNodes.messageCollector.waitForMessages(1)).to.eq(true);
  });

  const numTest = 2;
  for (let i = 0; i < numTest; i++) {
    // Random clusterId between 2 and 1000
    const clusterId = Math.floor(Math.random() * 999) + 2;

    // Random shardId between 1 and 1000
    const shardId = Math.floor(Math.random() * 1000) + 1;

    const networkConfig: StaticSharding = { clusterId };
    const routingInfo = createRoutingInfo(networkConfig, { shardId });

    it(`random static sharding ${
      i + 1
    } - Cluster ID: ${clusterId}, Shard ID: ${shardId}`, async function () {
      [serviceNodes, waku] = await runMultipleNodes(
        this.ctx,
        routingInfo,
        { lightpush: true, filter: true },
        false,
        numServiceNodes,
        true
      );

      const encoder = createEncoder({
        contentTopic: ContentTopic,
        routingInfo
      });

      const request = await waku.lightPush.send(encoder, {
        payload: utf8ToBytes("Hello World")
      });

      expect(request.successes.length).to.eq(numServiceNodes);
      expect(await serviceNodes.messageCollector.waitForMessages(1)).to.eq(
        true
      );
    });
  }
});

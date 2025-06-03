import { createEncoder } from "@waku/core";
import type { LightNode } from "@waku/interfaces";
import { utf8ToBytes } from "@waku/sdk";
import { expect } from "chai";

import {
  afterEachCustom,
  beforeEachCustom,
  runMultipleNodes,
  ServiceNodesFleet,
  teardownNodesWithRedundancy
} from "../../src/index.js";

import { TestContentTopic, TestEncoder, TestShardInfo } from "./utils.js";

describe("Waku Light Push V3: Relay Features", function () {
  this.timeout(30000);
  let waku: LightNode;
  let serviceNodes: ServiceNodesFleet;

  beforeEachCustom(this, async () => {
    [serviceNodes, waku] = await runMultipleNodes(
      this.ctx,
      TestShardInfo,
      { lightpush: true, filter: true },
      undefined,
      2,
      true
    );
  });

  afterEachCustom(this, async () => {
    await teardownNodesWithRedundancy(serviceNodes, waku);
  });

  it("should expose relay peer count in v3 responses", async function () {
    const messageText = "Test relay count";

    const pushResponse = await waku.lightPush.send(TestEncoder, {
      payload: utf8ToBytes(messageText)
    });

    expect(pushResponse.successes.length).to.be.greaterThan(0);
  });

  it("should support optional pubsub topic for autosharding", async function () {
    const encoder = createEncoder({
      contentTopic: TestContentTopic
    });

    expect(encoder.pubsubTopic).to.exist;
    expect(encoder.pubsubTopic).to.not.be.empty;

    const pushResponse = await waku.lightPush.send(encoder, {
      payload: utf8ToBytes("Autosharding test")
    });

    expect(
      pushResponse.successes.length + pushResponse.failures.length
    ).to.be.greaterThan(0);
  });
});

import { LightNode } from "@waku/interfaces";
import { createEncoder, utf8ToBytes } from "@waku/sdk";
import { expect } from "chai";
import { describe } from "mocha";

import {
  afterEachCustom,
  beforeEachCustom,
  DefaultTestShardInfo,
  DefaultTestSingleShardInfo,
  runMultipleNodes,
  ServiceNodesFleet,
  teardownNodesWithRedundancy
} from "../../src/index.js";
import { TestContentTopic } from "../filter/utils.js";

describe("Waku Light Push: Connection Management: E2E", function () {
  this.timeout(15000);
  let waku: LightNode;
  let serviceNodes: ServiceNodesFleet;

  beforeEachCustom(this, async () => {
    [serviceNodes, waku] = await runMultipleNodes(
      this.ctx,
      DefaultTestShardInfo,
      undefined,
      undefined,
      5
    );
  });

  afterEachCustom(this, async () => {
    await teardownNodesWithRedundancy(serviceNodes, waku);
  });

  const encoder = createEncoder({
    pubsubTopicShardInfo: DefaultTestSingleShardInfo,
    contentTopic: TestContentTopic
  });

  it("should push to needed amount of connections", async function () {
    const { successes, failures } = await waku.lightPush.send(encoder, {
      payload: utf8ToBytes("Hello_World")
    });

    expect(successes.length).to.be.equal(waku.lightPush.numPeersToUse);
    expect(failures?.length || 0).to.equal(0);
  });

  it("should push to available amount of connection if less than required", async function () {
    const connections = waku.libp2p.getConnections();
    await Promise.all(
      connections
        .slice(0, connections.length - 1)
        .map((c) => waku.connectionManager.dropConnection(c.remotePeer))
    );

    const { successes, failures } = await waku.lightPush.send(encoder, {
      payload: utf8ToBytes("Hello_World")
    });

    expect(successes.length).to.be.equal(1);
    expect(failures?.length || 0).to.equal(0);
  });

  it("should fail to send if no connections available", async function () {
    const connections = waku.libp2p.getConnections();
    await Promise.all(
      connections.map((c) =>
        waku.connectionManager.dropConnection(c.remotePeer)
      )
    );

    const { successes, failures } = await waku.lightPush.send(encoder, {
      payload: utf8ToBytes("Hello_World")
    });

    expect(successes.length).to.be.equal(0);
    expect(failures?.length).to.equal(1);
  });
});

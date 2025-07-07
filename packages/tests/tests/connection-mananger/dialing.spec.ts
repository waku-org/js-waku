import { LightNode } from "@waku/interfaces";
import { expect } from "chai";
import type { Context } from "mocha";

import {
  afterEachCustom,
  beforeEachCustom,
  runMultipleNodes,
  ServiceNodesFleet,
  teardownNodesWithRedundancy
} from "../../src/index.js";

import { TestShardInfo } from "./utils.js";

describe("Dialing", function () {
  const ctx: Context = this.ctx;
  let waku: LightNode;
  let serviceNodes: ServiceNodesFleet;

  beforeEachCustom(this, async () => {
    [serviceNodes, waku] = await runMultipleNodes(
      this.ctx,
      TestShardInfo,
      { lightpush: true, filter: true, peerExchange: true },
      false,
      2,
      true
    );

    await teardownNodesWithRedundancy(serviceNodes, []);

    serviceNodes = await ServiceNodesFleet.createAndRun(
      ctx,
      2,
      false,
      TestShardInfo,
      {
        lightpush: true,
        filter: true,
        peerExchange: true
      },
      false
    );
  });

  afterEachCustom(this, async () => {
    await teardownNodesWithRedundancy(serviceNodes, [waku]);
  });

  it("should dial all peers on dial", async function () {
    for (const node of serviceNodes.nodes) {
      const addr = await node.getMultiaddrWithId();
      await waku.dial(addr);
    }

    const peers = await waku.getConnectedPeers();
    expect(peers.length).to.equal(
      serviceNodes.nodes.length,
      "Connection should be established"
    );
  });

  it("should drop connection to all peers on hangUp", async function () {
    for (const node of serviceNodes.nodes) {
      const addr = await node.getMultiaddrWithId();
      await waku.dial(addr);
    }

    let peers = await waku.getConnectedPeers();
    expect(peers.length).to.equal(
      serviceNodes.nodes.length,
      "Connection should be established"
    );

    for (const node of serviceNodes.nodes) {
      const peerId = await node.getPeerId();
      await waku.hangUp(peerId);
    }

    peers = await waku.getConnectedPeers();
    expect(peers.length).to.equal(0, "Connection should be dropped");
  });

  it("should dial one peer on dial", async function () {
    const addr = await serviceNodes.nodes[0].getMultiaddrWithId();
    await waku.dial(addr);

    const peers = await waku.getConnectedPeers();
    expect(peers.length).to.equal(1, "Connection should be established");
  });

  it("should drop connection to one peer on hangUp", async function () {
    for (const node of serviceNodes.nodes) {
      const addr = await node.getMultiaddrWithId();
      await waku.dial(addr);
    }

    let peers = await waku.getConnectedPeers();
    expect(peers.length).to.equal(
      serviceNodes.nodes.length,
      "Connection should be established"
    );

    const peerId = await serviceNodes.nodes[0].getPeerId();
    await waku.hangUp(peerId);

    peers = await waku.getConnectedPeers();
    expect(peers.length).to.equal(
      serviceNodes.nodes.length - 1,
      "Connection should be dropped"
    );
  });

  it("should drop connection via multiaddr with hangUp", async function () {
    for (const node of serviceNodes.nodes) {
      const addr = await node.getMultiaddrWithId();
      await waku.dial(addr);
    }

    let peers = await waku.getConnectedPeers();
    expect(peers.length).to.equal(
      serviceNodes.nodes.length,
      "Connection should be established"
    );

    const addr = await serviceNodes.nodes[0].getMultiaddrWithId();
    await waku.hangUp(addr);

    peers = await waku.getConnectedPeers();
    expect(peers.length).to.equal(
      serviceNodes.nodes.length - 1,
      "Connection should be dropped"
    );
  });
});

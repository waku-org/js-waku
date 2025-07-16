import { LightNode, Tags } from "@waku/interfaces";
import { expect } from "chai";

import {
  afterEachCustom,
  beforeEachCustom,
  runMultipleNodes,
  ServiceNodesFleet,
  teardownNodesWithRedundancy
} from "../../src/index.js";

import { TestShardInfo } from "./utils.js";

describe("Connection Limiter", function () {
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
  });

  afterEachCustom(this, async () => {
    await teardownNodesWithRedundancy(serviceNodes, [waku]);
  });

  it("should dial all known peers when reached zero connections", async function () {
    let peers = await waku.getConnectedPeers();
    expect(peers.length).to.equal(
      serviceNodes.nodes.length,
      "Connection should be established"
    );

    for (const node of serviceNodes.nodes) {
      const addr = await node.getMultiaddrWithId();
      await waku.hangUp(addr);
    }

    peers = await waku.getConnectedPeers();
    expect(peers.length).to.equal(0, "Connection should be dropped");

    const connectPromise = new Promise((resolve) => {
      waku.libp2p.addEventListener("peer:connect", (event) => {
        resolve(event.detail);
      });
    });

    await connectPromise;

    peers = await waku.getConnectedPeers();
    // checking for greater than 0 because in CI environment, nwaku not always accepts dial
    expect(peers.length).to.be.greaterThan(
      0,
      "Connection should be established"
    );
  });

  it("should discard bootstrap peers when has more than set limit", async function () {
    this.timeout(15_000); // increase due to additional initialization

    await teardownNodesWithRedundancy(serviceNodes, [waku]);

    [serviceNodes, waku] = await runMultipleNodes(
      this.ctx,
      TestShardInfo,
      { lightpush: true, filter: true, peerExchange: true },
      false,
      2,
      true,
      { connectionManager: { maxBootstrapPeers: 1 } }
    );

    let peers = await waku.getConnectedPeers();
    expect(peers.length).to.equal(
      serviceNodes.nodes.length,
      "Connection should be established"
    );

    for (const node of serviceNodes.nodes) {
      const peerId = await node.getPeerId();
      await waku.libp2p.peerStore.patch(peerId, {
        tags: new Map([[Tags.BOOTSTRAP, { value: 1 }]])
      });
    }

    const disconnectPromise = new Promise((resolve) => {
      waku.libp2p.addEventListener("peer:disconnect", (event) => {
        resolve(event.detail);
      });
    });

    // simulate connection to a peer
    waku.libp2p.dispatchEvent(
      new CustomEvent("peer:connect", {
        detail: await serviceNodes.nodes[0].getPeerId()
      })
    );

    await disconnectPromise;

    peers = await waku.getConnectedPeers();
    expect(peers.length).to.equal(
      serviceNodes.nodes.length - 1,
      "Should have only one peer dropped"
    );

    const bootstrapPeers = peers.filter((peer) =>
      peer.tags.has(Tags.BOOTSTRAP)
    );
    expect(bootstrapPeers.length).to.equal(
      1,
      "Should have only one bootstrap peer"
    );
  });

  it("should not discard bootstrap peers if under the limit", async function () {
    this.timeout(15_000); // increase due to additional initialization

    await teardownNodesWithRedundancy(serviceNodes, [waku]);

    [serviceNodes, waku] = await runMultipleNodes(
      this.ctx,
      TestShardInfo,
      { lightpush: true, filter: true, peerExchange: true },
      false,
      2,
      true,
      { connectionManager: { maxBootstrapPeers: 2 } }
    );

    let peers = await waku.getConnectedPeers();
    expect(peers.length).to.equal(
      serviceNodes.nodes.length,
      "Connection should be established"
    );

    for (const node of serviceNodes.nodes) {
      const peerId = await node.getPeerId();
      await waku.libp2p.peerStore.patch(peerId, {
        tags: new Map([[Tags.BOOTSTRAP, { value: 1 }]])
      });
    }

    const disconnectPromise = new Promise((resolve) => {
      waku.libp2p.addEventListener("peer:disconnect", () => {
        resolve(true);
      });

      setTimeout(() => resolve(false), 1000);
    });

    // simulate connection to a peer
    waku.libp2p.dispatchEvent(
      new CustomEvent("peer:connect", {
        detail: await serviceNodes.nodes[0].getPeerId()
      })
    );

    const hasDisconnected = await disconnectPromise;
    expect(hasDisconnected).to.equal(false, "Should not disconnect");

    peers = await waku.getConnectedPeers();
    expect(peers.length).to.equal(
      serviceNodes.nodes.length,
      "Should have all peers"
    );

    const bootstrapPeers = peers.filter((peer) =>
      peer.tags.has(Tags.BOOTSTRAP)
    );
    expect(bootstrapPeers.length).to.equal(
      2,
      "Should have only two bootstrap peers"
    );
  });
});

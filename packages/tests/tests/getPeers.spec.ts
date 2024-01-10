import { LightPushCodec, waitForRemotePeer } from "@waku/core";
import {
  createLightNode,
  type LightNode,
  Protocols,
  ShardInfo
} from "@waku/sdk";
import { shardInfoToPubsubTopics } from "@waku/utils";
import { getConnectedPeersForProtocolAndShard } from "@waku/utils/libp2p";
import { expect } from "chai";

import { makeLogFileName } from "../src/log_file.js";
import { NimGoNode } from "../src/node/node.js";
import { tearDownNodes } from "../src/teardown.js";

describe("getConnectedPeersForProtocolAndShard", function () {
  let waku: LightNode;
  let serviceNode1: NimGoNode;
  let serviceNode2: NimGoNode;

  this.beforeEach(async function () {
    this.timeout(15000);
    serviceNode1 = new NimGoNode(makeLogFileName(this) + "1");
    serviceNode2 = new NimGoNode(makeLogFileName(this) + "2");
  });

  afterEach(async function () {
    this.timeout(15000);
    await tearDownNodes([serviceNode1, serviceNode2], waku);
  });

  it("same cluster, same shard: nodes connect", async function () {
    this.timeout(15000);

    const shardInfo: ShardInfo = {
      clusterId: 1,
      shards: [1]
    };

    await serviceNode1.start({
      discv5Discovery: true,
      peerExchange: true,
      clusterId: shardInfo.clusterId,
      pubsubTopic: shardInfoToPubsubTopics(shardInfo),
      lightpush: true
    });

    const serviceNodeMa = await serviceNode1.getMultiaddrWithId();

    waku = await createLightNode({ shardInfo });
    await waku.start();
    await waku.libp2p.dialProtocol(serviceNodeMa, LightPushCodec);
    await waitForRemotePeer(waku, [Protocols.LightPush]);
    const peers = await getConnectedPeersForProtocolAndShard(
      waku.libp2p.getConnections(),
      waku.libp2p.peerStore,
      waku.libp2p.getProtocols(),
      shardInfo
    );
    expect(peers.length).to.be.greaterThan(0);
  });

  it("same cluster, different shard: nodes connect", async function () {
    this.timeout(15000);

    const shardInfo: ShardInfo = {
      clusterId: 1,
      shards: [1]
    };

    await serviceNode1.start({
      discv5Discovery: true,
      peerExchange: true,
      clusterId: shardInfo.clusterId,
      pubsubTopic: shardInfoToPubsubTopics(shardInfo),
      lightpush: true
    });

    const serviceNodeMa = await serviceNode1.getMultiaddrWithId();

    waku = await createLightNode({ shardInfo });
    await waku.libp2p.dialProtocol(serviceNodeMa, LightPushCodec);
    await waku.start();
    await waitForRemotePeer(waku, [Protocols.LightPush]);

    const peers = await getConnectedPeersForProtocolAndShard(
      waku.libp2p.getConnections(),
      waku.libp2p.peerStore,
      waku.libp2p.getProtocols(),
      shardInfo
    );
    expect(peers.length).to.be.greaterThan(0);
  });

  it("different cluster, same shard: nodes don't connect", async function () {
    this.timeout(15000);

    const shardInfo1: ShardInfo = {
      clusterId: 1,
      shards: [1]
    };

    const shardInfo2: ShardInfo = {
      clusterId: 2,
      shards: [1]
    };

    // we start one node in a separate cluster
    await serviceNode1.start({
      discv5Discovery: true,
      peerExchange: true,
      clusterId: shardInfo1.clusterId,
      pubsubTopic: shardInfoToPubsubTopics(shardInfo1),
      lightpush: true
    });

    // and another node in the same cluster cluster as our node
    await serviceNode2.start({
      discv5Discovery: true,
      peerExchange: true,
      clusterId: shardInfo2.clusterId,
      pubsubTopic: shardInfoToPubsubTopics(shardInfo2),
      lightpush: true
    });

    const serviceNode1Ma = await serviceNode1.getMultiaddrWithId();
    const serviceNode2Ma = await serviceNode2.getMultiaddrWithId();

    waku = await createLightNode({ shardInfo: shardInfo2 });
    await waku.libp2p.dialProtocol(serviceNode1Ma, LightPushCodec);
    await waku.libp2p.dialProtocol(serviceNode2Ma, LightPushCodec);

    await waku.start();
    await waitForRemotePeer(waku, [Protocols.LightPush]);

    const peers = await getConnectedPeersForProtocolAndShard(
      waku.libp2p.getConnections(),
      waku.libp2p.peerStore,
      waku.libp2p.getProtocols(),
      shardInfo2
    );
    expect(peers.length).to.be.equal(1);
  });

  it("different cluster, different shard: nodes don't connect", async function () {
    this.timeout(15000);

    const shardInfo1: ShardInfo = {
      clusterId: 1,
      shards: [1]
    };

    const shardInfo2: ShardInfo = {
      clusterId: 2,
      shards: [2]
    };

    // we start one node in a separate cluster
    await serviceNode1.start({
      discv5Discovery: true,
      peerExchange: true,
      clusterId: shardInfo1.clusterId,
      pubsubTopic: shardInfoToPubsubTopics(shardInfo1),
      lightpush: true
    });

    // and another node in the same cluster cluster as our node
    const serviceNode2 = new NimGoNode(makeLogFileName(this) + "2");
    await serviceNode2.start({
      discv5Discovery: true,
      peerExchange: true,
      clusterId: shardInfo2.clusterId,
      pubsubTopic: shardInfoToPubsubTopics(shardInfo2),
      lightpush: true
    });

    const serviceNodeMa1 = await serviceNode1.getMultiaddrWithId();
    const serviceNodeMa2 = await serviceNode2.getMultiaddrWithId();

    waku = await createLightNode({ shardInfo: shardInfo2 });
    await waku.libp2p.dialProtocol(serviceNodeMa1, LightPushCodec);
    await waku.libp2p.dialProtocol(serviceNodeMa2, LightPushCodec);
    await waku.start();
    await waitForRemotePeer(waku, [Protocols.LightPush]);

    const peers = await getConnectedPeersForProtocolAndShard(
      waku.libp2p.getConnections(),
      waku.libp2p.peerStore,
      waku.libp2p.getProtocols(),
      shardInfo2
    );
    expect(peers.length).to.be.equal(1);
  });
});

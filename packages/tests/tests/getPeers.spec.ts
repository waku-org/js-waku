import { LightPushCodec, waitForRemotePeer } from "@waku/core";
import {
  createLightNode,
  type LightNode,
  Protocols,
  ShardInfo
} from "@waku/sdk";
import { shardInfoToPubsubTopics } from "@waku/utils";
import { getPeersForProtocolAndShard } from "@waku/utils/libp2p";
import { expect } from "chai";

import { makeLogFileName } from "../src/log_file.js";
import { NimGoNode } from "../src/node/node.js";
import { tearDownNodes } from "../src/teardown.js";

describe("getPeersForProtocolAndShard", function () {
  let waku: LightNode;
  let serviceNode: NimGoNode;

  this.beforeEach(async function () {
    this.timeout(15000);
    serviceNode = new NimGoNode(makeLogFileName(this) + "1");
  });

  afterEach(async function () {
    this.timeout(15000);
    await tearDownNodes([serviceNode], waku);
  });

  it("same cluster, same shard: nodes connect", async function () {
    this.timeout(15000);

    const shardInfo: ShardInfo = {
      clusterId: 1,
      shards: [1]
    };

    await serviceNode.start({
      discv5Discovery: true,
      peerExchange: true,
      clusterId: shardInfo.clusterId,
      pubsubTopic: shardInfoToPubsubTopics(shardInfo),
      lightpush: true
    });

    const serviceNodeMa = await serviceNode.getMultiaddrWithId();

    waku = await createLightNode({ shardInfo });
    await waku.start();
    await waku.libp2p.dialProtocol(serviceNodeMa, LightPushCodec);
    await waitForRemotePeer(waku, [Protocols.LightPush]);
    const peers = await getPeersForProtocolAndShard(
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

    await serviceNode.start({
      discv5Discovery: true,
      peerExchange: true,
      clusterId: shardInfo.clusterId,
      pubsubTopic: shardInfoToPubsubTopics(shardInfo),
      lightpush: true
    });

    const serviceNodeMa = await serviceNode.getMultiaddrWithId();

    waku = await createLightNode({ shardInfo });
    await waku.libp2p.dialProtocol(serviceNodeMa, LightPushCodec);
    await waku.start();
    await waitForRemotePeer(waku, [Protocols.LightPush]);

    const peers = await getPeersForProtocolAndShard(
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

    await serviceNode.start({
      discv5Discovery: true,
      peerExchange: true,
      clusterId: shardInfo1.clusterId,
      pubsubTopic: shardInfoToPubsubTopics(shardInfo1),
      lightpush: true
    });

    const serviceNodeMa = await serviceNode.getMultiaddrWithId();

    waku = await createLightNode({ shardInfo: shardInfo2 });
    await waku.libp2p.dialProtocol(serviceNodeMa, LightPushCodec);
    await waku.start();
    await waitForRemotePeer(waku, [Protocols.LightPush]);

    const peers = await getPeersForProtocolAndShard(
      waku.libp2p.peerStore,
      waku.libp2p.getProtocols(),
      shardInfo2
    );
    expect(peers.length).to.be.equal(0);
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

    await serviceNode.start({
      discv5Discovery: true,
      peerExchange: true,
      clusterId: shardInfo1.clusterId,
      pubsubTopic: shardInfoToPubsubTopics(shardInfo1),
      lightpush: true
    });

    const serviceNodeMa = await serviceNode.getMultiaddrWithId();

    waku = await createLightNode({ shardInfo: shardInfo2 });
    await waku.libp2p.dialProtocol(serviceNodeMa, LightPushCodec);
    await waku.start();
    await waitForRemotePeer(waku, [Protocols.LightPush]);

    const peers = await getPeersForProtocolAndShard(
      waku.libp2p.peerStore,
      waku.libp2p.getProtocols(),
      shardInfo2
    );
    expect(peers.length).to.be.equal(0);
  });
});

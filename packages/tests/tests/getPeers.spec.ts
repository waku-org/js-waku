import { MetadataCodec } from "@waku/core";
import { createLightNode, type LightNode, ShardInfo } from "@waku/sdk";
import { shardInfoToPubsubTopics } from "@waku/utils";
import { getPeersForProtocolAndShard } from "@waku/utils/libp2p";
import { expect } from "chai";

import { delay } from "../src/delay.js";
import { makeLogFileName } from "../src/log_file.js";
import { NimGoNode } from "../src/node/node.js";
import { tearDownNodes } from "../src/teardown.js";

describe.only("getPeersForProtocolAndShard", function () {
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
      pubsubTopic: shardInfoToPubsubTopics(shardInfo)
    });

    const serviceNodeMa = await serviceNode.getMultiaddrWithId();

    waku = await createLightNode({ shardInfo });
    await waku.libp2p.dialProtocol(serviceNodeMa, MetadataCodec);
    await waku.start();
    // The delay is added to give time for the metadata protocol to be processed
    //TODO: remove delay
    await delay(100);

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
      pubsubTopic: shardInfoToPubsubTopics(shardInfo)
    });

    const serviceNodeMa = await serviceNode.getMultiaddrWithId();

    waku = await createLightNode({ shardInfo });
    await waku.libp2p.dialProtocol(serviceNodeMa, MetadataCodec);
    await waku.start();
    // The delay is added to give time for the metadata protocol to be processed
    await delay(100);

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
      pubsubTopic: shardInfoToPubsubTopics(shardInfo1)
    });

    const serviceNodeMa = await serviceNode.getMultiaddrWithId();

    waku = await createLightNode({ shardInfo: shardInfo2 });
    await waku.libp2p.dialProtocol(serviceNodeMa, MetadataCodec);
    await waku.start();
    // add a delay to make sure the connection is closed from the other side
    await delay(100);

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
      pubsubTopic: shardInfoToPubsubTopics(shardInfo1)
    });

    const serviceNodeMa = await serviceNode.getMultiaddrWithId();

    waku = await createLightNode({ shardInfo: shardInfo2 });
    await waku.libp2p.dialProtocol(serviceNodeMa, MetadataCodec);
    await waku.start();
    // add a delay to make sure the connection is closed from the other side
    await delay(100);

    const peers = await getPeersForProtocolAndShard(
      waku.libp2p.peerStore,
      waku.libp2p.getProtocols(),
      shardInfo2
    );
    expect(peers.length).to.be.equal(0);
  });
});

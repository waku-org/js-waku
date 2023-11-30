import { MetadataCodec } from "@waku/core";
import type { LightNode, ShardInfo } from "@waku/interfaces";
import { createLightNode } from "@waku/sdk";
import { shardInfoToPubsubTopics } from "@waku/utils";
import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";

import { tearDownNodes } from "../src/index.js";
import { makeLogFileName } from "../src/log_file.js";
import { NimGoNode } from "../src/node/node.js";

chai.use(chaiAsPromised);

describe("Metadata Protocol", () => {
  let waku: LightNode;
  let nwaku1: NimGoNode;

  beforeEach(function () {
    nwaku1 = new NimGoNode(makeLogFileName(this) + "1");
  });

  afterEach(async function () {
    this.timeout(15000);
    await tearDownNodes([nwaku1], waku);
  });

  it("same cluster, same shard: nodes connect", async function () {
    this.timeout(55_000);

    const shardInfo: ShardInfo = {
      clusterId: 1,
      shards: [1]
    };

    await nwaku1.start({
      relay: true,
      discv5Discovery: true,
      peerExchange: true,
      clusterId: shardInfo.clusterId,
      pubsubTopic: shardInfoToPubsubTopics(shardInfo)
    });

    const nwaku1Ma = await nwaku1.getMultiaddrWithId();
    const nwaku1PeerId = await nwaku1.getPeerId();

    waku = await createLightNode({ shardInfo });
    await waku.start();
    await waku.libp2p.dialProtocol(nwaku1Ma, MetadataCodec);

    const shardInfoRes =
      await waku.libp2p.services.metadata?.query(nwaku1PeerId);
    expect(shardInfoRes).to.not.be.undefined;
    expect(shardInfoRes?.clusterId).to.equal(shardInfo.clusterId);
    expect(shardInfoRes?.shards).to.deep.equal(shardInfo.shards);
  });

  it("same cluster, different shard: nodes connect", async function () {
    this.timeout(55_000);

    const shardInfo1: ShardInfo = {
      clusterId: 1,
      shards: [1]
    };

    const shardInfo2: ShardInfo = {
      clusterId: 1,
      shards: [2]
    };

    await nwaku1.start({
      relay: true,
      discv5Discovery: true,
      peerExchange: true,
      clusterId: shardInfo1.clusterId,
      pubsubTopic: shardInfoToPubsubTopics(shardInfo1)
    });

    const nwaku1Ma = await nwaku1.getMultiaddrWithId();
    const nwaku1PeerId = await nwaku1.getPeerId();

    waku = await createLightNode({ shardInfo: shardInfo2 });
    await waku.start();
    await waku.libp2p.dialProtocol(nwaku1Ma, MetadataCodec);

    const shardInfoRes =
      await waku.libp2p.services.metadata?.query(nwaku1PeerId);
    expect(shardInfoRes).to.not.be.undefined;
    expect(shardInfoRes?.clusterId).to.equal(shardInfo1.clusterId);
    expect(shardInfoRes?.shards).to.deep.equal(shardInfo1.shards);
  });

  it("different cluster, same shard: nodes don't connect", async function () {
    this.timeout(55_000);

    const shardInfo1: ShardInfo = {
      clusterId: 1,
      shards: [1]
    };

    const shardInfo2: ShardInfo = {
      clusterId: 2,
      shards: [1]
    };

    await nwaku1.start({
      relay: true,
      discv5Discovery: true,
      peerExchange: true,
      clusterId: shardInfo1.clusterId,
      pubsubTopic: shardInfoToPubsubTopics(shardInfo1)
    });

    const nwaku1Ma = await nwaku1.getMultiaddrWithId();
    const nwaku1PeerId = await nwaku1.getPeerId();

    waku = await createLightNode({ shardInfo: shardInfo2 });
    await waku.start();
    await waku.libp2p.dialProtocol(nwaku1Ma, MetadataCodec);

    await expect(
      waku.libp2p.services.metadata?.query(nwaku1PeerId)
    ).to.be.rejectedWith("the connection is being closed");
  });

  it("different cluster, different shard: nodes don't connect", async function () {
    this.timeout(55_000);

    const shardInfo1: ShardInfo = {
      clusterId: 1,
      shards: [1]
    };

    const shardInfo2: ShardInfo = {
      clusterId: 2,
      shards: [2]
    };

    await nwaku1.start({
      relay: true,
      discv5Discovery: true,
      peerExchange: true,
      clusterId: shardInfo1.clusterId,
      pubsubTopic: shardInfoToPubsubTopics(shardInfo1)
    });

    const nwaku1Ma = await nwaku1.getMultiaddrWithId();
    const nwaku1PeerId = await nwaku1.getPeerId();

    waku = await createLightNode({ shardInfo: shardInfo2 });
    await waku.start();
    await waku.libp2p.dialProtocol(nwaku1Ma, MetadataCodec);

    await expect(
      waku.libp2p.services.metadata?.query(nwaku1PeerId)
    ).to.be.rejectedWith("the connection is being closed");
  });
});

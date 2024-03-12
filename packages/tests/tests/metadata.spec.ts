import { MetadataCodec } from "@waku/core";
import type { LightNode, ShardInfo } from "@waku/interfaces";
import { createLightNode } from "@waku/sdk";
import { decodeRelayShard } from "@waku/utils";
import { shardInfoToPubsubTopics } from "@waku/utils";
import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";

import {
  afterEachCustom,
  beforeEachCustom,
  delay,
  makeLogFileName,
  ServiceNode,
  tearDownNodes
} from "../src/index.js";

chai.use(chaiAsPromised);

describe("Metadata Protocol", function () {
  this.timeout(55000);
  let waku: LightNode;
  let nwaku1: ServiceNode;

  beforeEachCustom(this, async () => {
    nwaku1 = new ServiceNode(makeLogFileName(this.ctx) + "1");
  });

  afterEachCustom(this, async () => {
    await tearDownNodes([nwaku1], waku);
  });

  describe("connections", function () {
    it("same cluster, same shard: nodes connect", async function () {
      const shardInfo: ShardInfo = {
        clusterId: 2,
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
      expect(shardInfoRes?.shards).to.include.members(shardInfo.shards);

      const activeConnections = waku.libp2p.getConnections();
      expect(activeConnections.length).to.equal(1);
    });

    it("same cluster, different shard: nodes connect", async function () {
      const shardInfo1: ShardInfo = {
        clusterId: 0,
        shards: [1]
      };

      const shardInfo2: ShardInfo = {
        clusterId: 0,
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
      expect(shardInfoRes?.shards).to.include.members(shardInfo1.shards);

      const activeConnections = waku.libp2p.getConnections();
      expect(activeConnections.length).to.equal(1);
    });

    it("different cluster, same shard: nodes don't connect", async function () {
      const shardInfo1: ShardInfo = {
        clusterId: 2,
        shards: [1]
      };

      const shardInfo2: ShardInfo = {
        clusterId: 3,
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

      waku = await createLightNode({ shardInfo: shardInfo2 });
      await waku.start();
      await waku.libp2p.dialProtocol(nwaku1Ma, MetadataCodec);

      // add a delay to make sure the connection is closed from the other side
      await delay(100);

      const activeConnections = waku.libp2p.getConnections();
      expect(activeConnections.length).to.equal(0);
    });

    it("different cluster, different shard: nodes don't connect", async function () {
      const shardInfo1: ShardInfo = {
        clusterId: 2,
        shards: [1]
      };

      const shardInfo2: ShardInfo = {
        clusterId: 3,
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

      waku = await createLightNode({ shardInfo: shardInfo2 });
      await waku.start();
      await waku.libp2p.dialProtocol(nwaku1Ma, MetadataCodec);

      // add a delay to make sure the connection is closed from the other side
      await delay(100);

      const activeConnections = waku.libp2p.getConnections();
      expect(activeConnections.length).to.equal(0);
    });
  });

  it("PeerStore has remote peer's shard info after successful connection", async function () {
    const shardInfo: ShardInfo = {
      clusterId: 2,
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

    // delay to ensure the connection is estabilished and shardInfo is updated
    await delay(500);

    const encodedShardInfo = (
      await waku.libp2p.peerStore.get(nwaku1PeerId)
    ).metadata.get("shardInfo");
    expect(encodedShardInfo).to.not.be.undefined;

    const metadataShardInfo = decodeRelayShard(encodedShardInfo!);
    expect(metadataShardInfo).not.be.undefined;

    expect(metadataShardInfo!.clusterId).to.eq(shardInfo.clusterId);
    expect(metadataShardInfo.shards).to.include.members(shardInfo.shards);
  });
});

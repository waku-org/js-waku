import { MetadataCodec } from "@waku/core";
import type { LightNode } from "@waku/interfaces";
import { createLightNode } from "@waku/sdk";
import { decodeRelayShard } from "@waku/utils";
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

  describe("static sharding", function () {
    it("same cluster, static sharding: nodes connect", async function () {
      const clusterId = 2;
      const shards = [1];
      const numShardsInCluster = 8;

      await nwaku1.start({
        relay: true,
        discv5Discovery: true,
        peerExchange: true,
        clusterId,
        shard: shards,
        numShardsInNetwork: numShardsInCluster
      });

      const nwaku1Ma = await nwaku1.getMultiaddrWithId();
      const nwaku1PeerId = await nwaku1.getPeerId();

      waku = await createLightNode({
        networkConfig: { clusterId, numShardsInCluster }
      });
      await waku.start();
      await waku.libp2p.dialProtocol(nwaku1Ma, MetadataCodec);

      if (!waku.libp2p.services.metadata) {
        expect(waku.libp2p.services.metadata).to.not.be.undefined;
        return;
      }

      const { error, shardInfo: shardInfoRes } =
        await waku.libp2p.services.metadata.query(nwaku1PeerId);

      if (error) {
        expect(error).to.be.null;
        return;
      }

      expect(shardInfoRes).to.not.be.undefined;
      expect(shardInfoRes.clusterId).to.equal(clusterId);
      expect(shardInfoRes.shards).to.include.members(shards);

      const activeConnections = waku.libp2p.getConnections();
      expect(activeConnections.length).to.equal(1);
    });

    it("different cluster:  nodes don't connect", async function () {
      const clusterIdNwaku = 2;
      const custerIdJsWaku = 3;
      const shards = [1];
      const numShardsInCluster = 8;

      await nwaku1.start({
        relay: true,
        discv5Discovery: true,
        peerExchange: true,
        clusterId: clusterIdNwaku,
        shard: shards,
        numShardsInNetwork: numShardsInCluster
      });

      const nwaku1Ma = await nwaku1.getMultiaddrWithId();

      waku = await createLightNode({
        networkConfig: { clusterId: custerIdJsWaku, numShardsInCluster }
      });
      await waku.start();
      await waku.libp2p.dialProtocol(nwaku1Ma, MetadataCodec);

      // ensure the connection is closed from the other side
      let counter = 0;
      while (waku.libp2p.getConnections().length !== 0) {
        if (counter > 10) {
          break;
        }
        await delay(100);
        counter++;
      }

      expect(waku.libp2p.getConnections().length).to.equal(0);
    });

    it("PeerStore has remote peer's shard info after successful connection", async function () {
      const clusterId = 2;
      const shards = [1];
      const numShardsInCluster = 8;

      await nwaku1.start({
        relay: true,
        discv5Discovery: true,
        peerExchange: true,
        clusterId,
        shard: shards,
        numShardsInNetwork: numShardsInCluster
      });

      const nwaku1Ma = await nwaku1.getMultiaddrWithId();
      const nwaku1PeerId = await nwaku1.getPeerId();

      waku = await createLightNode({
        networkConfig: { clusterId, numShardsInCluster }
      });
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

      expect(metadataShardInfo!.clusterId).to.eq(clusterId);
      expect(metadataShardInfo.shards).to.include.members(shards);
    });

    it("receiving a ping from a peer does not overwrite shard info", async function () {
      const clusterId = 2;
      const shards = [1];
      const numShardsInCluster = 0; //static sharding

      await nwaku1.start({
        relay: true,
        discv5Discovery: true,
        peerExchange: true,
        clusterId,
        shard: shards,
        numShardsInNetwork: numShardsInCluster
      });

      const nwaku1Ma = await nwaku1.getMultiaddrWithId();
      const nwaku1PeerId = await nwaku1.getPeerId();

      waku = await createLightNode({
        networkConfig: {
          clusterId,
          numShardsInCluster
        },
        connectionManager: {
          pingKeepAlive: 1
        }
      });
      await waku.start();
      await waku.libp2p.dialProtocol(nwaku1Ma, MetadataCodec);

      // delay to ensure the connection is estabilished, shardInfo is updated, and there is a ping
      await delay(1500);

      const metadata = (await waku.libp2p.peerStore.get(nwaku1PeerId)).metadata;
      expect(metadata.get("shardInfo")).to.not.be.undefined;

      const pingInfo = metadata.get("ping");
      expect(pingInfo).to.not.be.undefined;
    });
  });
  describe("auto sharding", function () {
    it("same cluster: nodes connect", async function () {
      const clusterId = 2;
      const contentTopic = "/foo/1/bar/proto";
      const numShardsInCluster = 0;

      await nwaku1.start({
        relay: true,
        discv5Discovery: true,
        peerExchange: true,
        clusterId,
        contentTopic: [contentTopic],
        numShardsInNetwork: numShardsInCluster
      });

      const nwaku1Ma = await nwaku1.getMultiaddrWithId();
      const nwaku1PeerId = await nwaku1.getPeerId();

      waku = await createLightNode({
        networkConfig: { clusterId, numShardsInCluster }
      });
      await waku.start();
      await waku.libp2p.dialProtocol(nwaku1Ma, MetadataCodec);

      if (!waku.libp2p.services.metadata) {
        expect(waku.libp2p.services.metadata).to.not.be.undefined;
        return;
      }

      const { error, shardInfo: shardInfoRes } =
        await waku.libp2p.services.metadata.query(nwaku1PeerId);

      if (error) {
        expect(error).to.be.null;
        return;
      }

      expect(shardInfoRes).to.not.be.undefined;
      expect(shardInfoRes.clusterId).to.equal(clusterId);
      // TODO: calculate shards from content topics
      //expect(shardInfoRes.shards).to.include.members(shards);

      const activeConnections = waku.libp2p.getConnections();
      expect(activeConnections.length).to.equal(1);
    });

    it("different cluster: nodes don't connect", async function () {
      const clusterIdNwaku = 2;
      const clusterIdJSWaku = 3;
      const contentTopic = ["/foo/1/bar/proto"];
      const numShardsInCluster = 0;

      await nwaku1.start({
        relay: true,
        discv5Discovery: true,
        peerExchange: true,
        clusterId: clusterIdNwaku,
        contentTopic,
        numShardsInNetwork: numShardsInCluster
      });

      const nwaku1Ma = await nwaku1.getMultiaddrWithId();

      waku = await createLightNode({
        networkConfig: {
          clusterId: clusterIdJSWaku,
          numShardsInCluster
        }
      });
      await waku.start();
      await waku.libp2p.dialProtocol(nwaku1Ma, MetadataCodec);

      // ensure the connection is closed from the other side
      let counter = 0;
      while (waku.libp2p.getConnections().length !== 0) {
        if (counter > 10) {
          console.error("Connection was not closed");
          break;
        }
        await delay(100);
        counter++;
      }

      expect(waku.libp2p.getConnections().length).to.equal(0);
    });

    it("PeerStore has remote peer's shard info after successful connection", async function () {
      const clusterId = 2;
      const contentTopic = ["/foo/1/bar/proto"];
      const numShardsInCluster = 0;

      await nwaku1.start({
        relay: true,
        discv5Discovery: true,
        peerExchange: true,
        clusterId,
        contentTopic
      });

      const nwaku1Ma = await nwaku1.getMultiaddrWithId();
      const nwaku1PeerId = await nwaku1.getPeerId();

      waku = await createLightNode({
        networkConfig: { clusterId, numShardsInCluster }
      });
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

      expect(metadataShardInfo!.clusterId).to.eq(clusterId);
      // TODO derive shard from content topic
      // expect(metadataShardInfo.shards).to.include.members(shards);
    });

    it("receiving a ping from a peer does not overwrite shard info", async function () {
      const clusterId = 2;
      const contentTopic = ["/foo/1/bar/proto"];
      const numShardsInCluster = 0;

      await nwaku1.start({
        relay: true,
        discv5Discovery: true,
        peerExchange: true,
        clusterId,
        contentTopic
      });

      const nwaku1Ma = await nwaku1.getMultiaddrWithId();
      const nwaku1PeerId = await nwaku1.getPeerId();

      waku = await createLightNode({
        networkConfig: {
          clusterId,
          numShardsInCluster
        },
        connectionManager: {
          pingKeepAlive: 1
        }
      });
      await waku.start();
      await waku.libp2p.dialProtocol(nwaku1Ma, MetadataCodec);

      // delay to ensure the connection is estabilished, shardInfo is updated, and there is a ping
      await delay(1500);

      const metadata = (await waku.libp2p.peerStore.get(nwaku1PeerId)).metadata;
      expect(metadata.get("shardInfo")).to.not.be.undefined;

      const pingInfo = metadata.get("ping");
      expect(pingInfo).to.not.be.undefined;
    });
  });
});

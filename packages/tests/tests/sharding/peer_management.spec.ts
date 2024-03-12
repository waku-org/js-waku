import { bootstrap } from "@libp2p/bootstrap";
import type { PeerId } from "@libp2p/interface";
import { wakuPeerExchangeDiscovery } from "@waku/discovery";
import {
  ContentTopicInfo,
  createLightNode,
  LightNode,
  ShardInfo,
  Tags
} from "@waku/sdk";
import {
  contentTopicToPubsubTopic,
  singleShardInfoToPubsubTopic
} from "@waku/utils";
import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import Sinon, { SinonSpy } from "sinon";

import {
  afterEachCustom,
  beforeEachCustom,
  delay,
  makeLogFileName,
  resolveAutoshardingCluster,
  ServiceNode,
  tearDownNodes
} from "../../src/index.js";

chai.use(chaiAsPromised);

describe("Static Sharding: Peer Management", function () {
  describe("Peer Exchange", function () {
    let waku: LightNode;
    let nwaku1: ServiceNode;
    let nwaku2: ServiceNode;
    let nwaku3: ServiceNode;

    let dialPeerSpy: SinonSpy;
    const clusterId = 18;

    beforeEachCustom(this, async () => {
      nwaku1 = new ServiceNode(makeLogFileName(this.ctx) + "1");
      nwaku2 = new ServiceNode(makeLogFileName(this.ctx) + "2");
      nwaku3 = new ServiceNode(makeLogFileName(this.ctx) + "3");
    });

    afterEachCustom(this, async () => {
      await tearDownNodes([nwaku1, nwaku2, nwaku3], waku);
      dialPeerSpy && dialPeerSpy.restore();
    });

    it("all px service nodes subscribed to the shard topic should be dialed", async function () {
      this.timeout(100_000);

      const pubsubTopics = [
        singleShardInfoToPubsubTopic({ clusterId: clusterId, shard: 2 })
      ];
      const shardInfo: ShardInfo = { clusterId: clusterId, shards: [2] };

      await nwaku1.start({
        pubsubTopic: pubsubTopics,
        discv5Discovery: true,
        peerExchange: true,
        relay: true,
        clusterId: clusterId
      });

      const enr1 = (await nwaku1.info()).enrUri;

      await nwaku2.start({
        pubsubTopic: pubsubTopics,
        discv5Discovery: true,
        peerExchange: true,
        discv5BootstrapNode: enr1,
        relay: true,
        clusterId: clusterId
      });

      const enr2 = (await nwaku2.info()).enrUri;

      await nwaku3.start({
        pubsubTopic: pubsubTopics,
        discv5Discovery: true,
        peerExchange: true,
        discv5BootstrapNode: enr2,
        relay: true,
        clusterId: clusterId
      });
      const nwaku3Ma = await nwaku3.getMultiaddrWithId();

      waku = await createLightNode({
        shardInfo: shardInfo,
        libp2p: {
          peerDiscovery: [
            bootstrap({ list: [nwaku3Ma.toString()] }),
            wakuPeerExchangeDiscovery(pubsubTopics)
          ]
        }
      });

      await waku.start();

      dialPeerSpy = Sinon.spy((waku as any).connectionManager, "dialPeer");

      const pxPeersDiscovered = new Set<PeerId>();

      await new Promise<void>((resolve) => {
        waku.libp2p.addEventListener("peer:discovery", (evt) => {
          return void (async () => {
            const peerId = evt.detail.id;
            const peer = await waku.libp2p.peerStore.get(peerId);
            const tags = Array.from(peer.tags.keys());
            if (tags.includes(Tags.PEER_EXCHANGE)) {
              pxPeersDiscovered.add(peerId);
              if (pxPeersDiscovered.size === 2) {
                resolve();
              }
            }
          })();
        });
      });

      await delay(1000);

      expect(dialPeerSpy.callCount).to.equal(3);
    });

    it("px service nodes not subscribed to the shard should not be dialed", async function () {
      this.timeout(100_000);
      const pubsubTopicsToDial = [
        singleShardInfoToPubsubTopic({ clusterId: clusterId, shard: 2 })
      ];
      const shardInfoToDial: ShardInfo = { clusterId: clusterId, shards: [2] };
      const pubsubTopicsToIgnore = [
        singleShardInfoToPubsubTopic({ clusterId: clusterId, shard: 1 })
      ];

      // this service node is not subscribed to the shard
      await nwaku1.start({
        pubsubTopic: pubsubTopicsToIgnore,
        relay: true,
        discv5Discovery: true,
        peerExchange: true,
        clusterId: clusterId
      });

      const enr1 = (await nwaku1.info()).enrUri;

      await nwaku2.start({
        pubsubTopic: pubsubTopicsToDial,
        relay: true,
        discv5Discovery: true,
        peerExchange: true,
        discv5BootstrapNode: enr1,
        clusterId: clusterId
      });

      const enr2 = (await nwaku2.info()).enrUri;

      await nwaku3.start({
        pubsubTopic: pubsubTopicsToDial,
        relay: true,
        discv5Discovery: true,
        peerExchange: true,
        discv5BootstrapNode: enr2,
        clusterId: clusterId
      });
      const nwaku3Ma = await nwaku3.getMultiaddrWithId();

      waku = await createLightNode({
        shardInfo: shardInfoToDial,
        libp2p: {
          peerDiscovery: [
            bootstrap({ list: [nwaku3Ma.toString()] }),
            wakuPeerExchangeDiscovery(pubsubTopicsToDial)
          ]
        }
      });

      dialPeerSpy = Sinon.spy((waku as any).connectionManager, "dialPeer");

      await waku.start();

      const pxPeersDiscovered = new Set<PeerId>();

      await new Promise<void>((resolve) => {
        waku.libp2p.addEventListener("peer:discovery", (evt) => {
          return void (async () => {
            const peerId = evt.detail.id;
            const peer = await waku.libp2p.peerStore.get(peerId);
            const tags = Array.from(peer.tags.keys());
            if (tags.includes(Tags.PEER_EXCHANGE)) {
              pxPeersDiscovered.add(peerId);
              if (pxPeersDiscovered.size === 1) {
                resolve();
              }
            }
          })();
        });
      });

      await delay(1000);
      expect(dialPeerSpy.callCount).to.equal(2);
    });
  });
});

describe("Autosharding: Peer Management", function () {
  const ContentTopic = "/myapp/1/latest/proto";
  const clusterId = resolveAutoshardingCluster(8);

  describe("Peer Exchange", function () {
    let waku: LightNode;
    let nwaku1: ServiceNode;
    let nwaku2: ServiceNode;
    let nwaku3: ServiceNode;

    let dialPeerSpy: SinonSpy;

    beforeEachCustom(this, async () => {
      nwaku1 = new ServiceNode(makeLogFileName(this.ctx) + "1_auto");
      nwaku2 = new ServiceNode(makeLogFileName(this.ctx) + "2_auto");
      nwaku3 = new ServiceNode(makeLogFileName(this.ctx) + "3_auto");
    });

    afterEachCustom(this, async () => {
      await tearDownNodes([nwaku1, nwaku2, nwaku3], waku);
      dialPeerSpy && dialPeerSpy.restore();
    });

    it("all px service nodes subscribed to the shard topic should be dialed", async function () {
      this.timeout(100_000);

      const pubsubTopics = [contentTopicToPubsubTopic(ContentTopic, clusterId)];
      const contentTopicInfo: ContentTopicInfo = {
        clusterId: clusterId,
        contentTopics: [ContentTopic]
      };

      await nwaku1.start({
        pubsubTopic: pubsubTopics,
        discv5Discovery: true,
        peerExchange: true,
        relay: true,
        clusterId: clusterId,
        contentTopic: [ContentTopic]
      });

      const enr1 = (await nwaku1.info()).enrUri;

      await nwaku2.start({
        pubsubTopic: pubsubTopics,
        discv5Discovery: true,
        peerExchange: true,
        discv5BootstrapNode: enr1,
        relay: true,
        clusterId: clusterId,
        contentTopic: [ContentTopic]
      });

      const enr2 = (await nwaku2.info()).enrUri;

      await nwaku3.start({
        pubsubTopic: pubsubTopics,
        discv5Discovery: true,
        peerExchange: true,
        discv5BootstrapNode: enr2,
        relay: true,
        clusterId: clusterId,
        contentTopic: [ContentTopic]
      });
      const nwaku3Ma = await nwaku3.getMultiaddrWithId();

      waku = await createLightNode({
        shardInfo: contentTopicInfo,
        libp2p: {
          peerDiscovery: [
            bootstrap({ list: [nwaku3Ma.toString()] }),
            wakuPeerExchangeDiscovery(pubsubTopics)
          ]
        }
      });

      await waku.start();

      dialPeerSpy = Sinon.spy((waku as any).connectionManager, "dialPeer");

      const pxPeersDiscovered = new Set<PeerId>();

      await new Promise<void>((resolve) => {
        waku.libp2p.addEventListener("peer:discovery", (evt) => {
          return void (async () => {
            const peerId = evt.detail.id;
            const peer = await waku.libp2p.peerStore.get(peerId);
            const tags = Array.from(peer.tags.keys());
            if (tags.includes(Tags.PEER_EXCHANGE)) {
              pxPeersDiscovered.add(peerId);
              if (pxPeersDiscovered.size === 2) {
                resolve();
              }
            }
          })();
        });
      });

      await delay(1000);

      expect(dialPeerSpy.callCount).to.equal(3);
    });

    it("px service nodes not subscribed to the shard should not be dialed", async function () {
      this.timeout(100_000);
      const pubsubTopicsToDial = [
        contentTopicToPubsubTopic(ContentTopic, clusterId)
      ];
      const contentTopicInfoToDial: ContentTopicInfo = {
        clusterId: clusterId,
        contentTopics: [ContentTopic]
      };
      const pubsubTopicsToIgnore = [contentTopicToPubsubTopic(ContentTopic, 3)];

      // this service node is not subscribed to the shard
      await nwaku1.start({
        pubsubTopic: pubsubTopicsToIgnore,
        relay: true,
        discv5Discovery: true,
        peerExchange: true,
        clusterId: 3
      });

      const enr1 = (await nwaku1.info()).enrUri;

      await nwaku2.start({
        pubsubTopic: pubsubTopicsToDial,
        relay: true,
        discv5Discovery: true,
        peerExchange: true,
        discv5BootstrapNode: enr1,
        clusterId: clusterId,
        contentTopic: [ContentTopic]
      });

      const enr2 = (await nwaku2.info()).enrUri;

      await nwaku3.start({
        pubsubTopic: pubsubTopicsToDial,
        relay: true,
        discv5Discovery: true,
        peerExchange: true,
        discv5BootstrapNode: enr2,
        clusterId: clusterId,
        contentTopic: [ContentTopic]
      });
      const nwaku3Ma = await nwaku3.getMultiaddrWithId();

      waku = await createLightNode({
        shardInfo: contentTopicInfoToDial,
        libp2p: {
          peerDiscovery: [
            bootstrap({ list: [nwaku3Ma.toString()] }),
            wakuPeerExchangeDiscovery(pubsubTopicsToDial)
          ]
        }
      });

      dialPeerSpy = Sinon.spy((waku as any).connectionManager, "dialPeer");

      await waku.start();

      const pxPeersDiscovered = new Set<PeerId>();

      await new Promise<void>((resolve) => {
        waku.libp2p.addEventListener("peer:discovery", (evt) => {
          return void (async () => {
            const peerId = evt.detail.id;
            const peer = await waku.libp2p.peerStore.get(peerId);
            const tags = Array.from(peer.tags.keys());
            if (tags.includes(Tags.PEER_EXCHANGE)) {
              pxPeersDiscovered.add(peerId);
              if (pxPeersDiscovered.size === 1) {
                resolve();
              }
            }
          })();
        });
      });

      await delay(1000);
      expect(dialPeerSpy.callCount).to.equal(2);
    });
  });
});

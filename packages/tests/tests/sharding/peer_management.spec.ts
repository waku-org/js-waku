import { bootstrap } from "@libp2p/bootstrap";
import type { PeerId } from "@libp2p/interface";
import { wakuPeerExchangeDiscovery } from "@waku/peer-exchange";
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
  delay,
  makeLogFileName,
  MOCHA_HOOK_MAX_TIMEOUT,
  ServiceNode,
  tearDownNodes,
  withGracefulTimeout
} from "../../src/index.js";

chai.use(chaiAsPromised);

describe("Static Sharding: Peer Management", function () {
  describe("Peer Exchange", function () {
    let waku: LightNode;
    let nwaku1: ServiceNode;
    let nwaku2: ServiceNode;
    let nwaku3: ServiceNode;

    let dialPeerSpy: SinonSpy;

    this.beforeEach(function (done) {
      this.timeout(MOCHA_HOOK_MAX_TIMEOUT);
      const runAllNodes: () => Promise<void> = async () => {
        nwaku1 = new ServiceNode(makeLogFileName(this) + "1");
        nwaku2 = new ServiceNode(makeLogFileName(this) + "2");
        nwaku3 = new ServiceNode(makeLogFileName(this) + "3");
      };
      withGracefulTimeout(runAllNodes, 20000, done);
    });

    this.afterEach(function (done) {
      this.timeout(MOCHA_HOOK_MAX_TIMEOUT);
      const teardown: () => Promise<void> = async () => {
        await tearDownNodes([nwaku1, nwaku2, nwaku3], waku);
        dialPeerSpy && dialPeerSpy.restore();
      };
      withGracefulTimeout(teardown, 20000, done);
    });

    it("all px service nodes subscribed to the shard topic should be dialed", async function () {
      this.timeout(100_000);

      const pubsubTopics = [
        singleShardInfoToPubsubTopic({ clusterId: 18, shard: 2 })
      ];
      const shardInfo: ShardInfo = { clusterId: 18, shards: [2] };

      await nwaku1.start({
        pubsubTopic: pubsubTopics,
        discv5Discovery: true,
        peerExchange: true,
        relay: true
      });

      const enr1 = (await nwaku1.info()).enrUri;

      await nwaku2.start({
        pubsubTopic: pubsubTopics,
        discv5Discovery: true,
        peerExchange: true,
        discv5BootstrapNode: enr1,
        relay: true
      });

      const enr2 = (await nwaku2.info()).enrUri;

      await nwaku3.start({
        pubsubTopic: pubsubTopics,
        discv5Discovery: true,
        peerExchange: true,
        discv5BootstrapNode: enr2,
        relay: true
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
        singleShardInfoToPubsubTopic({ clusterId: 18, shard: 2 })
      ];
      const shardInfoToDial: ShardInfo = { clusterId: 18, shards: [2] };
      const pubsubTopicsToIgnore = [
        singleShardInfoToPubsubTopic({ clusterId: 18, shard: 1 })
      ];

      // this service node is not subscribed to the shard
      await nwaku1.start({
        pubsubTopic: pubsubTopicsToIgnore,
        relay: true,
        discv5Discovery: true,
        peerExchange: true
      });

      const enr1 = (await nwaku1.info()).enrUri;

      await nwaku2.start({
        pubsubTopic: pubsubTopicsToDial,
        relay: true,
        discv5Discovery: true,
        peerExchange: true,
        discv5BootstrapNode: enr1
      });

      const enr2 = (await nwaku2.info()).enrUri;

      await nwaku3.start({
        relay: true,
        discv5Discovery: true,
        peerExchange: true,
        discv5BootstrapNode: enr2
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
  const ContentTopic = "/waku/2/content/test.js";

  describe("Peer Exchange", function () {
    let waku: LightNode;
    let nwaku1: ServiceNode;
    let nwaku2: ServiceNode;
    let nwaku3: ServiceNode;

    let dialPeerSpy: SinonSpy;

    this.beforeEach(function (done) {
      this.timeout(MOCHA_HOOK_MAX_TIMEOUT);
      const runAllNodes: () => Promise<void> = async () => {
        nwaku1 = new ServiceNode(makeLogFileName(this) + "1_auto");
        nwaku2 = new ServiceNode(makeLogFileName(this) + "2_auto");
        nwaku3 = new ServiceNode(makeLogFileName(this) + "3_auto");
      };
      withGracefulTimeout(runAllNodes, 20000, done);
    });

    this.afterEach(function (done) {
      this.timeout(MOCHA_HOOK_MAX_TIMEOUT);
      const teardown: () => Promise<void> = async () => {
        await tearDownNodes([nwaku1, nwaku2, nwaku3], waku);
        dialPeerSpy && dialPeerSpy.restore();
      };
      withGracefulTimeout(teardown, 20000, done);
    });

    it("all px service nodes subscribed to the shard topic should be dialed", async function () {
      this.timeout(100_000);

      const pubsubTopics = [contentTopicToPubsubTopic(ContentTopic, 1)];
      const contentTopicInfo: ContentTopicInfo = {
        clusterId: 1,
        contentTopics: [ContentTopic]
      };

      await nwaku1.start({
        pubsubTopic: pubsubTopics,
        discv5Discovery: true,
        peerExchange: true,
        relay: true
      });

      const enr1 = (await nwaku1.info()).enrUri;

      await nwaku2.start({
        pubsubTopic: pubsubTopics,
        discv5Discovery: true,
        peerExchange: true,
        discv5BootstrapNode: enr1,
        relay: true
      });

      const enr2 = (await nwaku2.info()).enrUri;

      await nwaku3.start({
        pubsubTopic: pubsubTopics,
        discv5Discovery: true,
        peerExchange: true,
        discv5BootstrapNode: enr2,
        relay: true
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
      const pubsubTopicsToDial = [contentTopicToPubsubTopic(ContentTopic, 1)];
      const contentTopicInfoToDial: ContentTopicInfo = {
        clusterId: 1,
        contentTopics: [ContentTopic]
      };
      const pubsubTopicsToIgnore = [contentTopicToPubsubTopic(ContentTopic, 2)];

      // this service node is not subscribed to the shard
      await nwaku1.start({
        pubsubTopic: pubsubTopicsToIgnore,
        relay: true,
        discv5Discovery: true,
        peerExchange: true
      });

      const enr1 = (await nwaku1.info()).enrUri;

      await nwaku2.start({
        pubsubTopic: pubsubTopicsToDial,
        relay: true,
        discv5Discovery: true,
        peerExchange: true,
        discv5BootstrapNode: enr1
      });

      const enr2 = (await nwaku2.info()).enrUri;

      await nwaku3.start({
        relay: true,
        discv5Discovery: true,
        peerExchange: true,
        discv5BootstrapNode: enr2
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

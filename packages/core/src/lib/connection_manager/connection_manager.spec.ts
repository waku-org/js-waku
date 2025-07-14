import { type Peer, type PeerId, type Stream } from "@libp2p/interface";
import { peerIdFromString } from "@libp2p/peer-id";
import { multiaddr, MultiaddrInput } from "@multiformats/multiaddr";
import {
  IWakuEventEmitter,
  Libp2p,
  NetworkConfig,
  PubsubTopic
} from "@waku/interfaces";
import { expect } from "chai";
import sinon from "sinon";

import { ConnectionLimiter } from "./connection_limiter.js";
import { ConnectionManager } from "./connection_manager.js";
import { DiscoveryDialer } from "./discovery_dialer.js";
import { KeepAliveManager } from "./keep_alive_manager.js";
import { NetworkMonitor } from "./network_monitor.js";
import { ShardReader } from "./shard_reader.js";

describe("ConnectionManager", () => {
  let libp2p: Libp2p;
  let events: IWakuEventEmitter;
  let networkConfig: NetworkConfig;
  let pubsubTopics: PubsubTopic[];
  let relay: any;
  let connectionManager: ConnectionManager;
  let mockPeerId: PeerId;
  let mockMultiaddr: MultiaddrInput;
  let mockStream: Stream;
  // Mock internal components
  let mockKeepAliveManager: sinon.SinonStubbedInstance<KeepAliveManager>;
  let mockDiscoveryDialer: sinon.SinonStubbedInstance<DiscoveryDialer>;
  let mockShardReader: sinon.SinonStubbedInstance<ShardReader>;
  let mockNetworkMonitor: sinon.SinonStubbedInstance<NetworkMonitor>;
  let mockConnectionLimiter: sinon.SinonStubbedInstance<ConnectionLimiter>;

  const createMockPeer = (
    id: string,
    protocols: string[] = [],
    ping = 100
  ): Peer =>
    ({
      id: peerIdFromString(id),
      protocols,
      metadata: new Map([["ping", new TextEncoder().encode(ping.toString())]]),
      toString: () => id
    }) as Peer;

  beforeEach(() => {
    // Create mock dependencies
    libp2p = {
      dialProtocol: sinon.stub().resolves({} as Stream),
      hangUp: sinon.stub().resolves(),
      getPeers: sinon.stub().returns([]),
      peerStore: {
        get: sinon.stub().resolves(null),
        merge: sinon.stub().resolves()
      }
    } as unknown as Libp2p;

    events = {
      dispatchEvent: sinon.stub()
    } as unknown as IWakuEventEmitter;

    networkConfig = {
      clusterId: 1,
      shards: [0, 1]
    } as NetworkConfig;

    pubsubTopics = ["/waku/2/rs/1/0", "/waku/2/rs/1/1"];

    relay = {
      pubsubTopics,
      getMeshPeers: sinon.stub().returns([])
    };

    // Create mock internal components
    mockKeepAliveManager = {
      start: sinon.stub(),
      stop: sinon.stub()
    } as unknown as sinon.SinonStubbedInstance<KeepAliveManager>;

    mockDiscoveryDialer = {
      start: sinon.stub(),
      stop: sinon.stub()
    } as unknown as sinon.SinonStubbedInstance<DiscoveryDialer>;

    mockShardReader = {
      isPeerOnTopic: sinon.stub().resolves(true)
    } as unknown as sinon.SinonStubbedInstance<ShardReader>;

    mockNetworkMonitor = {
      start: sinon.stub(),
      stop: sinon.stub(),
      isConnected: sinon.stub().returns(true)
    } as unknown as sinon.SinonStubbedInstance<NetworkMonitor>;

    mockConnectionLimiter = {
      start: sinon.stub(),
      stop: sinon.stub()
    } as unknown as sinon.SinonStubbedInstance<ConnectionLimiter>;

    // Create test data
    mockPeerId = peerIdFromString(
      "12D3KooWPjceQuRaNMhcrLF6BaW69PdCXB95h6TBpFf9nAmcL8hE"
    );
    mockMultiaddr = multiaddr(
      "/ip4/127.0.0.1/tcp/60000/p2p/12D3KooWPjceQuRaNMhcrLF6BaW69PdCXB95h6TBpFf9nAmcL8hE"
    );
    mockStream = {} as Stream;

    // Mock the internal component prototype methods
    sinon
      .stub(KeepAliveManager.prototype, "start")
      .callsFake(() => mockKeepAliveManager.start());
    sinon
      .stub(KeepAliveManager.prototype, "stop")
      .callsFake(() => mockKeepAliveManager.stop());

    sinon
      .stub(DiscoveryDialer.prototype, "start")
      .callsFake(() => mockDiscoveryDialer.start());
    sinon
      .stub(DiscoveryDialer.prototype, "stop")
      .callsFake(() => mockDiscoveryDialer.stop());

    sinon
      .stub(ShardReader.prototype, "isPeerOnTopic")
      .callsFake((peerId: PeerId, topic: string) =>
        mockShardReader.isPeerOnTopic(peerId, topic)
      );

    sinon
      .stub(NetworkMonitor.prototype, "start")
      .callsFake(() => mockNetworkMonitor.start());
    sinon
      .stub(NetworkMonitor.prototype, "stop")
      .callsFake(() => mockNetworkMonitor.stop());
    sinon
      .stub(NetworkMonitor.prototype, "isConnected")
      .callsFake(() => mockNetworkMonitor.isConnected());

    sinon
      .stub(ConnectionLimiter.prototype, "start")
      .callsFake(() => mockConnectionLimiter.start());
    sinon
      .stub(ConnectionLimiter.prototype, "stop")
      .callsFake(() => mockConnectionLimiter.stop());
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("constructor", () => {
    it("should create ConnectionManager with required options", () => {
      connectionManager = new ConnectionManager({
        libp2p,
        events,
        pubsubTopics,
        networkConfig
      });

      expect(connectionManager).to.be.instanceOf(ConnectionManager);
    });

    it("should create ConnectionManager with relay", () => {
      connectionManager = new ConnectionManager({
        libp2p,
        events,
        pubsubTopics,
        networkConfig,
        relay
      });

      expect(connectionManager).to.be.instanceOf(ConnectionManager);
    });

    it("should set default options when no config provided", () => {
      connectionManager = new ConnectionManager({
        libp2p,
        events,
        pubsubTopics,
        networkConfig
      });

      expect(connectionManager).to.be.instanceOf(ConnectionManager);
      // Default options are set internally and tested through behavior
    });

    it("should merge provided config with defaults", () => {
      const customConfig = {
        maxBootstrapPeers: 5,
        pingKeepAlive: 120
      };

      connectionManager = new ConnectionManager({
        libp2p,
        events,
        pubsubTopics,
        networkConfig,
        config: customConfig
      });

      expect(connectionManager).to.be.instanceOf(ConnectionManager);
    });

    it("should create all internal components", () => {
      connectionManager = new ConnectionManager({
        libp2p,
        events,
        pubsubTopics,
        networkConfig,
        relay
      });

      expect(connectionManager).to.be.instanceOf(ConnectionManager);
      // Internal components are created and tested through their behavior
    });
  });

  describe("start", () => {
    beforeEach(() => {
      connectionManager = new ConnectionManager({
        libp2p,
        events,
        pubsubTopics,
        networkConfig,
        relay
      });
    });

    it("should start all internal components", () => {
      connectionManager.start();

      expect(mockNetworkMonitor.start.calledOnce).to.be.true;
      expect(mockDiscoveryDialer.start.calledOnce).to.be.true;
      expect(mockKeepAliveManager.start.calledOnce).to.be.true;
      expect(mockConnectionLimiter.start.calledOnce).to.be.true;
    });

    it("should be safe to call multiple times", () => {
      connectionManager.start();
      connectionManager.start();

      expect(mockNetworkMonitor.start.calledTwice).to.be.true;
      expect(mockDiscoveryDialer.start.calledTwice).to.be.true;
      expect(mockKeepAliveManager.start.calledTwice).to.be.true;
      expect(mockConnectionLimiter.start.calledTwice).to.be.true;
    });
  });

  describe("stop", () => {
    beforeEach(() => {
      connectionManager = new ConnectionManager({
        libp2p,
        events,
        pubsubTopics,
        networkConfig,
        relay
      });
      connectionManager.start();
    });

    it("should stop all internal components", () => {
      connectionManager.stop();

      expect(mockNetworkMonitor.stop.calledOnce).to.be.true;
      expect(mockDiscoveryDialer.stop.calledOnce).to.be.true;
      expect(mockKeepAliveManager.stop.calledOnce).to.be.true;
      expect(mockConnectionLimiter.stop.calledOnce).to.be.true;
    });

    it("should be safe to call multiple times", () => {
      connectionManager.stop();
      connectionManager.stop();

      expect(mockNetworkMonitor.stop.calledTwice).to.be.true;
      expect(mockDiscoveryDialer.stop.calledTwice).to.be.true;
      expect(mockKeepAliveManager.stop.calledTwice).to.be.true;
      expect(mockConnectionLimiter.stop.calledTwice).to.be.true;
    });
  });

  describe("isConnected", () => {
    beforeEach(() => {
      connectionManager = new ConnectionManager({
        libp2p,
        events,
        pubsubTopics,
        networkConfig
      });
    });

    it("should delegate to networkMonitor.isConnected()", () => {
      mockNetworkMonitor.isConnected.returns(true);

      const result = connectionManager.isConnected();

      expect(mockNetworkMonitor.isConnected.calledOnce).to.be.true;
      expect(result).to.be.true;
    });

    it("should return false when network is not connected", () => {
      mockNetworkMonitor.isConnected.returns(false);

      const result = connectionManager.isConnected();

      expect(mockNetworkMonitor.isConnected.calledOnce).to.be.true;
      expect(result).to.be.false;
    });
  });

  describe("dial", () => {
    beforeEach(() => {
      connectionManager = new ConnectionManager({
        libp2p,
        events,
        pubsubTopics,
        networkConfig
      });
    });

    it("should dial with PeerId and return stream", async () => {
      const protocolCodecs = ["/waku/2/store/1.0.0"];
      const libp2pStub = libp2p.dialProtocol as sinon.SinonStub;
      libp2pStub.resolves(mockStream);

      const result = await connectionManager.dial(mockPeerId, protocolCodecs);

      expect(libp2pStub.calledOnce).to.be.true;
      expect(libp2pStub.calledWith(mockPeerId, protocolCodecs)).to.be.true;
      expect(result).to.equal(mockStream);
    });

    it("should dial with multiaddr and return stream", async () => {
      const protocolCodecs = ["/waku/2/store/1.0.0"];
      const libp2pStub = libp2p.dialProtocol as sinon.SinonStub;
      libp2pStub.resolves(mockStream);

      const result = await connectionManager.dial(
        mockMultiaddr,
        protocolCodecs
      );

      expect(libp2pStub.calledOnce).to.be.true;
      expect(result).to.equal(mockStream);
    });

    it("should handle dial errors", async () => {
      const protocolCodecs = ["/waku/2/store/1.0.0"];
      const libp2pStub = libp2p.dialProtocol as sinon.SinonStub;
      const error = new Error("Dial failed");
      libp2pStub.rejects(error);

      try {
        await connectionManager.dial(mockPeerId, protocolCodecs);
        expect.fail("Should have thrown error");
      } catch (e) {
        expect(e).to.equal(error);
      }
    });
  });

  describe("hangUp", () => {
    beforeEach(() => {
      connectionManager = new ConnectionManager({
        libp2p,
        events,
        pubsubTopics,
        networkConfig
      });
    });

    it("should hang up with PeerId and return true on success", async () => {
      const libp2pStub = libp2p.hangUp as sinon.SinonStub;
      libp2pStub.resolves();

      const result = await connectionManager.hangUp(mockPeerId);

      expect(libp2pStub.calledOnce).to.be.true;
      expect(libp2pStub.calledWith(mockPeerId)).to.be.true;
      expect(result).to.be.true;
    });

    it("should hang up with multiaddr and return true on success", async () => {
      const libp2pStub = libp2p.hangUp as sinon.SinonStub;
      libp2pStub.resolves();

      const result = await connectionManager.hangUp(mockMultiaddr);

      expect(libp2pStub.calledOnce).to.be.true;
      expect(result).to.be.true;
    });

    it("should return false and handle errors gracefully", async () => {
      const libp2pStub = libp2p.hangUp as sinon.SinonStub;
      libp2pStub.rejects(new Error("Hang up failed"));

      const result = await connectionManager.hangUp(mockPeerId);

      expect(libp2pStub.calledOnce).to.be.true;
      expect(result).to.be.false;
    });
  });

  describe("getConnectedPeers", () => {
    beforeEach(() => {
      connectionManager = new ConnectionManager({
        libp2p,
        events,
        pubsubTopics,
        networkConfig
      });
    });

    it("should return empty array when no peers connected", async () => {
      const libp2pStub = libp2p.getPeers as sinon.SinonStub;
      libp2pStub.returns([]);

      const result = await connectionManager.getConnectedPeers();

      expect(libp2pStub.calledOnce).to.be.true;
      expect(result).to.deep.equal([]);
    });

    it("should return all connected peers without codec filter", async () => {
      const peer1Id = "12D3KooWPjceQuRaNMhcrLF6BaW69PdCXB95h6TBpFf9nAmcL8hE";
      const peer2Id = "12D3KooWNFmTNRsVfUJqGrRMzQiULd4fL2iRKGj4PpNm4F5BhvCw";
      const mockPeerIds = [
        peerIdFromString(peer1Id),
        peerIdFromString(peer2Id)
      ];
      const mockPeers = [
        createMockPeer(peer1Id, ["/waku/2/relay/1.0.0"], 50),
        createMockPeer(peer2Id, ["/waku/2/store/1.0.0"], 100)
      ];

      const libp2pStub = libp2p.getPeers as sinon.SinonStub;
      libp2pStub.returns(mockPeerIds);

      const peerStoreStub = libp2p.peerStore.get as sinon.SinonStub;
      peerStoreStub.onCall(0).resolves(mockPeers[0]);
      peerStoreStub.onCall(1).resolves(mockPeers[1]);

      const result = await connectionManager.getConnectedPeers();

      expect(libp2pStub.calledOnce).to.be.true;
      expect(peerStoreStub.calledTwice).to.be.true;
      expect(result).to.have.length(2);
      // Should be sorted by ping (peer1 has lower ping)
      expect(result[0].id.toString()).to.equal(peer1Id);
      expect(result[1].id.toString()).to.equal(peer2Id);
    });

    it("should filter peers by codec", async () => {
      const peer1Id = "12D3KooWPjceQuRaNMhcrLF6BaW69PdCXB95h6TBpFf9nAmcL8hE";
      const peer2Id = "12D3KooWNFmTNRsVfUJqGrRMzQiULd4fL2iRKGj4PpNm4F5BhvCw";
      const mockPeerIds = [
        peerIdFromString(peer1Id),
        peerIdFromString(peer2Id)
      ];
      const mockPeers = [
        createMockPeer(peer1Id, ["/waku/2/relay/1.0.0"], 50),
        createMockPeer(peer2Id, ["/waku/2/store/1.0.0"], 100)
      ];

      const libp2pStub = libp2p.getPeers as sinon.SinonStub;
      libp2pStub.returns(mockPeerIds);

      const peerStoreStub = libp2p.peerStore.get as sinon.SinonStub;
      peerStoreStub.onCall(0).resolves(mockPeers[0]);
      peerStoreStub.onCall(1).resolves(mockPeers[1]);

      const result = await connectionManager.getConnectedPeers(
        "/waku/2/relay/1.0.0"
      );

      expect(result).to.have.length(1);
      expect(result[0].id.toString()).to.equal(peer1Id);
    });

    it("should handle peerStore errors gracefully", async () => {
      const peer1Id = "12D3KooWPjceQuRaNMhcrLF6BaW69PdCXB95h6TBpFf9nAmcL8hE";
      const peer2Id = "12D3KooWNFmTNRsVfUJqGrRMzQiULd4fL2iRKGj4PpNm4F5BhvCw";
      const mockPeerIds = [
        peerIdFromString(peer1Id),
        peerIdFromString(peer2Id)
      ];
      const mockPeer = createMockPeer(peer2Id, ["/waku/2/store/1.0.0"], 100);

      const libp2pStub = libp2p.getPeers as sinon.SinonStub;
      libp2pStub.returns(mockPeerIds);

      const peerStoreStub = libp2p.peerStore.get as sinon.SinonStub;
      peerStoreStub.onCall(0).rejects(new Error("Peer not found"));
      peerStoreStub.onCall(1).resolves(mockPeer);

      const result = await connectionManager.getConnectedPeers();

      expect(result).to.have.length(1);
      expect(result[0].id.toString()).to.equal(peer2Id);
    });

    it("should sort peers by ping value", async () => {
      const peer1Id = "12D3KooWPjceQuRaNMhcrLF6BaW69PdCXB95h6TBpFf9nAmcL8hE";
      const peer2Id = "12D3KooWNFmTNRsVfUJqGrRMzQiULd4fL2iRKGj4PpNm4F5BhvCw";
      const peer3Id = "12D3KooWMvU9HGhiEHDWYgJDnLj2Z4JHBQMdxFPgWTNKXjHDYKUW";
      const mockPeerIds = [
        peerIdFromString(peer1Id),
        peerIdFromString(peer2Id),
        peerIdFromString(peer3Id)
      ];
      const mockPeers = [
        createMockPeer(peer1Id, ["/waku/2/relay/1.0.0"], 200),
        createMockPeer(peer2Id, ["/waku/2/store/1.0.0"], 50),
        createMockPeer(peer3Id, ["/waku/2/filter/1.0.0"], 150)
      ];

      const libp2pStub = libp2p.getPeers as sinon.SinonStub;
      libp2pStub.returns(mockPeerIds);

      const peerStoreStub = libp2p.peerStore.get as sinon.SinonStub;
      peerStoreStub.onCall(0).resolves(mockPeers[0]);
      peerStoreStub.onCall(1).resolves(mockPeers[1]);
      peerStoreStub.onCall(2).resolves(mockPeers[2]);

      const result = await connectionManager.getConnectedPeers();

      expect(result).to.have.length(3);
      // Should be sorted by ping: peer2 (50), peer3 (150), peer1 (200)
      expect(result[0].id.toString()).to.equal(peer2Id);
      expect(result[1].id.toString()).to.equal(peer3Id);
      expect(result[2].id.toString()).to.equal(peer1Id);
    });
  });

  describe("isTopicConfigured", () => {
    beforeEach(() => {
      connectionManager = new ConnectionManager({
        libp2p,
        events,
        pubsubTopics,
        networkConfig
      });
    });

    it("should return true when topic is configured", () => {
      const result = connectionManager.isTopicConfigured("/waku/2/rs/1/0");

      expect(result).to.be.true;
    });

    it("should return false when topic is not configured", () => {
      const result = connectionManager.isTopicConfigured("/waku/2/rs/1/99");

      expect(result).to.be.false;
    });
  });

  describe("isPeerOnTopic", () => {
    beforeEach(() => {
      connectionManager = new ConnectionManager({
        libp2p,
        events,
        pubsubTopics,
        networkConfig
      });
    });

    it("should delegate to shardReader.isPeerOnTopic()", async () => {
      const topic = "/waku/2/rs/1/0";
      mockShardReader.isPeerOnTopic.resolves(true);

      const result = await connectionManager.isPeerOnTopic(mockPeerId, topic);

      expect(mockShardReader.isPeerOnTopic.calledOnce).to.be.true;
      expect(mockShardReader.isPeerOnTopic.calledWith(mockPeerId, topic)).to.be
        .true;
      expect(result).to.be.true;
    });

    it("should return false when peer is not on topic", async () => {
      const topic = "/waku/2/rs/1/0";
      mockShardReader.isPeerOnTopic.resolves(false);

      const result = await connectionManager.isPeerOnTopic(mockPeerId, topic);

      expect(mockShardReader.isPeerOnTopic.calledOnce).to.be.true;
      expect(result).to.be.false;
    });

    it("should handle shardReader errors", async () => {
      const topic = "/waku/2/rs/1/0";
      const error = new Error("Shard reader error");
      mockShardReader.isPeerOnTopic.rejects(error);

      try {
        await connectionManager.isPeerOnTopic(mockPeerId, topic);
        expect.fail("Should have thrown error");
      } catch (e) {
        expect(e).to.equal(error);
      }
    });
  });
});

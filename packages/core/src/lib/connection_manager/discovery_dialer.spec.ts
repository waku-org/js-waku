import { PeerId, PeerInfo } from "@libp2p/interface";
import { expect } from "chai";
import { Libp2p } from "libp2p";
import sinon from "sinon";

import { DiscoveryDialer } from "./discovery_dialer.js";
import { ShardReader } from "./shard_reader.js";

describe("DiscoveryDialer", () => {
  let libp2p: Libp2p;
  let discoveryDialer: DiscoveryDialer;
  let mockPeerId: PeerId;
  let mockPeerInfo: PeerInfo;
  let mockShardReader: sinon.SinonStubbedInstance<ShardReader>;
  let clock: sinon.SinonFakeTimers;

  beforeEach(() => {
    libp2p = {
      addEventListener: sinon.stub(),
      removeEventListener: sinon.stub(),
      dial: sinon.stub().resolves(),
      getPeers: sinon.stub().returns([]),
      peerStore: {
        get: sinon.stub().resolves(undefined),
        save: sinon.stub().resolves(),
        merge: sinon.stub().resolves()
      }
    } as unknown as Libp2p;

    mockPeerId = {
      toString: () => "mock-peer-id",
      equals: (other: PeerId) => other.toString() === "mock-peer-id"
    } as PeerId;

    mockPeerInfo = {
      id: mockPeerId,
      multiaddrs: []
    } as PeerInfo;

    mockShardReader = {
      hasShardInfo: sinon.stub().resolves(false),
      isPeerOnNetwork: sinon.stub().resolves(true),
      isPeerOnShard: sinon.stub().resolves(true),
      isPeerOnTopic: sinon.stub().resolves(true)
    } as unknown as sinon.SinonStubbedInstance<ShardReader>;

    clock = sinon.useFakeTimers();
  });

  afterEach(() => {
    if (discoveryDialer) {
      discoveryDialer.stop();
    }
    clock.restore();
    sinon.restore();
  });

  describe("constructor", () => {
    it("should create an instance with libp2p and shardReader", () => {
      discoveryDialer = new DiscoveryDialer({
        libp2p,
        shardReader: mockShardReader
      });
      expect(discoveryDialer).to.be.instanceOf(DiscoveryDialer);
    });
  });

  describe("start", () => {
    beforeEach(() => {
      discoveryDialer = new DiscoveryDialer({
        libp2p,
        shardReader: mockShardReader
      });
    });

    it("should add event listener for peer:discovery", () => {
      discoveryDialer.start();

      const addEventListenerStub = libp2p.addEventListener as sinon.SinonStub;
      expect(addEventListenerStub.calledOnce).to.be.true;
      expect(
        addEventListenerStub.calledWith("peer:discovery", sinon.match.func)
      ).to.be.true;
    });

    it("should start dialing interval processor", () => {
      discoveryDialer.start();

      clock.tick(500);

      expect(clock.countTimers()).to.be.greaterThan(0);
    });

    it("should not create multiple intervals when called multiple times", () => {
      discoveryDialer.start();
      discoveryDialer.start();

      expect(clock.countTimers()).to.equal(1);
    });
  });

  describe("stop", () => {
    beforeEach(() => {
      discoveryDialer = new DiscoveryDialer({
        libp2p,
        shardReader: mockShardReader
      });
      discoveryDialer.start();
    });

    it("should remove event listener for peer:discovery", () => {
      discoveryDialer.stop();

      const removeEventListenerStub =
        libp2p.removeEventListener as sinon.SinonStub;
      expect(removeEventListenerStub.calledOnce).to.be.true;
      expect(
        removeEventListenerStub.calledWith("peer:discovery", sinon.match.func)
      ).to.be.true;
    });

    it("should clear the dialing interval", () => {
      expect(clock.countTimers()).to.be.greaterThan(0);

      discoveryDialer.stop();

      expect(clock.countTimers()).to.equal(0);
    });

    it("should be safe to call multiple times", () => {
      discoveryDialer.stop();
      discoveryDialer.stop();

      const removeEventListenerStub =
        libp2p.removeEventListener as sinon.SinonStub;
      expect(removeEventListenerStub.calledTwice).to.be.true;
    });
  });

  describe("peer discovery handling", () => {
    let eventHandler: (event: CustomEvent<PeerInfo>) => Promise<void>;

    beforeEach(() => {
      discoveryDialer = new DiscoveryDialer({
        libp2p,
        shardReader: mockShardReader
      });
      discoveryDialer.start();

      const addEventListenerStub = libp2p.addEventListener as sinon.SinonStub;
      eventHandler = addEventListenerStub.getCall(0).args[1];
    });

    it("should dial peer immediately when queue is empty", async () => {
      const peerStoreStub = libp2p.peerStore.get as sinon.SinonStub;
      peerStoreStub.resolves(undefined);

      const dialStub = libp2p.dial as sinon.SinonStub;
      dialStub.resolves();

      const mockEvent = new CustomEvent("peer:discovery", {
        detail: mockPeerInfo
      });

      await eventHandler(mockEvent);

      expect(dialStub.calledOnce).to.be.true;
      expect(dialStub.calledWith(mockPeerId)).to.be.true;
    });

    it("should handle dial errors gracefully", async () => {
      const peerStoreStub = libp2p.peerStore.get as sinon.SinonStub;
      peerStoreStub.resolves(undefined);

      const dialStub = libp2p.dial as sinon.SinonStub;
      dialStub.rejects(new Error("Dial failed"));

      const mockEvent = new CustomEvent("peer:discovery", {
        detail: mockPeerInfo
      });

      await eventHandler(mockEvent);

      expect(dialStub.calledOnce).to.be.true;
      expect(dialStub.calledWith(mockPeerId)).to.be.true;
    });
  });

  describe("queue processing", () => {
    let eventHandler: (event: CustomEvent<PeerInfo>) => Promise<void>;

    beforeEach(() => {
      discoveryDialer = new DiscoveryDialer({
        libp2p,
        shardReader: mockShardReader
      });
      discoveryDialer.start();

      const addEventListenerStub = libp2p.addEventListener as sinon.SinonStub;
      eventHandler = addEventListenerStub.getCall(0).args[1];
    });

    it("should process queue correctly", async () => {
      const peerStoreStub = libp2p.peerStore.get as sinon.SinonStub;
      peerStoreStub.resolves(undefined);

      const dialStub = libp2p.dial as sinon.SinonStub;
      dialStub.resolves();

      const mockEvent1 = new CustomEvent("peer:discovery", {
        detail: mockPeerInfo
      });

      await eventHandler(mockEvent1);

      expect(dialStub.calledOnce).to.be.true;
      expect(dialStub.calledWith(mockPeerId)).to.be.true;
    });

    it("should handle queue processing errors gracefully", async () => {
      const peerStoreStub = libp2p.peerStore.get as sinon.SinonStub;
      peerStoreStub.resolves(undefined);

      const dialStub = libp2p.dial as sinon.SinonStub;
      dialStub.rejects(new Error("Queue dial failed"));

      const mockEvent = new CustomEvent("peer:discovery", {
        detail: mockPeerInfo
      });

      await eventHandler(mockEvent);

      expect(dialStub.calledOnce).to.be.true;
      expect(dialStub.calledWith(mockPeerId)).to.be.true;
    });

    it("should not process empty queue", () => {
      const dialStub = libp2p.dial as sinon.SinonStub;

      clock.tick(500);

      expect(dialStub.called).to.be.false;
    });
  });

  describe("shard reader integration", () => {
    let eventHandler: (event: CustomEvent<PeerInfo>) => Promise<void>;

    beforeEach(() => {
      discoveryDialer = new DiscoveryDialer({
        libp2p,
        shardReader: mockShardReader
      });
      discoveryDialer.start();

      const addEventListenerStub = libp2p.addEventListener as sinon.SinonStub;
      eventHandler = addEventListenerStub.getCall(0).args[1];
    });

    it("should skip peers not on the same network", async () => {
      mockShardReader.hasShardInfo.resolves(true);
      mockShardReader.isPeerOnNetwork.resolves(false);

      const mockEvent = new CustomEvent("peer:discovery", {
        detail: mockPeerInfo
      });

      await eventHandler(mockEvent);

      const dialStub = libp2p.dial as sinon.SinonStub;
      expect(dialStub.called).to.be.false;
      sinon.assert.calledWith(mockShardReader.hasShardInfo, mockPeerId);
      sinon.assert.calledWith(mockShardReader.isPeerOnNetwork, mockPeerId);
    });

    it("should dial peers on the same network", async () => {
      mockShardReader.hasShardInfo.resolves(true);
      mockShardReader.isPeerOnNetwork.resolves(true);

      const mockEvent = new CustomEvent("peer:discovery", {
        detail: mockPeerInfo
      });

      await eventHandler(mockEvent);

      const dialStub = libp2p.dial as sinon.SinonStub;
      expect(dialStub.calledWith(mockPeerId)).to.be.true;
      sinon.assert.calledWith(mockShardReader.hasShardInfo, mockPeerId);
      sinon.assert.calledWith(mockShardReader.isPeerOnNetwork, mockPeerId);
    });

    it("should handle shard reader errors gracefully", async () => {
      mockShardReader.hasShardInfo.rejects(new Error("Shard reader error"));

      const mockEvent = new CustomEvent("peer:discovery", {
        detail: mockPeerInfo
      });

      await eventHandler(mockEvent);

      const dialStub = libp2p.dial as sinon.SinonStub;
      expect(dialStub.called).to.be.false;
    });
  });

  describe("integration", () => {
    it("should handle complete discovery-to-dial flow", async () => {
      const peerStoreStub = libp2p.peerStore.get as sinon.SinonStub;
      peerStoreStub.resolves(undefined);

      const dialStub = libp2p.dial as sinon.SinonStub;
      dialStub.resolves();

      discoveryDialer = new DiscoveryDialer({
        libp2p,
        shardReader: mockShardReader
      });
      discoveryDialer.start();

      const addEventListenerStub = libp2p.addEventListener as sinon.SinonStub;
      const eventHandler = addEventListenerStub.getCall(0).args[1];

      const mockEvent = new CustomEvent("peer:discovery", {
        detail: mockPeerInfo
      });

      await eventHandler(mockEvent);

      expect(dialStub.calledOnce).to.be.true;
      expect(dialStub.calledWith(mockPeerId)).to.be.true;

      discoveryDialer.stop();
      const removeEventListenerStub =
        libp2p.removeEventListener as sinon.SinonStub;
      expect(removeEventListenerStub.called).to.be.true;
    });
  });
});

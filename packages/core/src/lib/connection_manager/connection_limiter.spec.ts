import { type Connection, type Peer, type PeerId } from "@libp2p/interface";
import { Tags } from "@waku/interfaces";
import { expect } from "chai";
import sinon from "sinon";

import { ConnectionLimiter } from "./connection_limiter.js";

describe("ConnectionLimiter", () => {
  let libp2p: any;
  let connectionLimiter: ConnectionLimiter;
  let mockPeerId: PeerId;

  let mockConnection: Connection;

  let mockPeer: Peer;
  let mockPeer2: Peer;

  const createMockPeerId = (id: string): PeerId =>
    ({
      toString: () => id,
      equals: (other: PeerId) => other.toString() === id
    }) as PeerId;

  const createMockPeer = (id: string, tags: string[] = []): Peer =>
    ({
      id: createMockPeerId(id),
      tags: new Map(tags.map((tag) => [tag, { value: 0 }])),
      addresses: [],
      protocols: [],
      metadata: new Map(),
      toString: () => id
    }) as unknown as Peer;

  const createMockConnection = (
    peerId: PeerId,
    tags: string[] = []
  ): Connection =>
    ({
      remotePeer: peerId,
      tags
    }) as Connection;

  const defaultOptions = {
    maxBootstrapPeers: 2,
    pingKeepAlive: 300,
    relayKeepAlive: 300
  };

  beforeEach(() => {
    mockPeerId = createMockPeerId("12D3KooWTest1");

    mockPeer = createMockPeer("12D3KooWTest1", [Tags.BOOTSTRAP]);
    mockPeer2 = createMockPeer("12D3KooWTest2", []);
    mockConnection = createMockConnection(mockPeerId, [Tags.BOOTSTRAP]);

    libp2p = {
      addEventListener: sinon.stub(),
      removeEventListener: sinon.stub(),
      dial: sinon.stub().resolves(),
      hangUp: sinon.stub().resolves(),
      getConnections: sinon.stub().returns([]),
      peerStore: {
        all: sinon.stub().resolves([]),
        get: sinon.stub().resolves(mockPeer)
      }
    };
  });

  afterEach(() => {
    if (connectionLimiter) {
      connectionLimiter.stop();
    }
    sinon.restore();
  });

  describe("constructor", () => {
    it("should create ConnectionLimiter with required options", () => {
      connectionLimiter = new ConnectionLimiter({
        libp2p,
        options: defaultOptions
      });

      expect(connectionLimiter).to.be.instanceOf(ConnectionLimiter);
    });

    it("should store libp2p and options references", () => {
      connectionLimiter = new ConnectionLimiter({
        libp2p,
        options: defaultOptions
      });

      expect(connectionLimiter).to.have.property("libp2p");
      expect(connectionLimiter).to.have.property("options");
    });
  });

  describe("start", () => {
    beforeEach(() => {
      connectionLimiter = new ConnectionLimiter({
        libp2p,
        options: defaultOptions
      });
    });

    it("should dial peers from store on start", async () => {
      const dialPeersStub = sinon.stub(
        connectionLimiter,
        "dialPeersFromStore" as any
      );

      connectionLimiter.start();

      expect(dialPeersStub.calledOnce).to.be.true;
    });

    it("should add event listeners for peer connect and disconnect", () => {
      connectionLimiter.start();

      expect(libp2p.addEventListener.calledTwice).to.be.true;
      expect(
        libp2p.addEventListener.calledWith("peer:connect", sinon.match.func)
      ).to.be.true;
      expect(
        libp2p.addEventListener.calledWith("peer:disconnect", sinon.match.func)
      ).to.be.true;
    });

    it("should be safe to call multiple times", () => {
      connectionLimiter.start();
      connectionLimiter.start();

      expect(libp2p.addEventListener.callCount).to.equal(4);
    });
  });

  describe("stop", () => {
    beforeEach(() => {
      connectionLimiter = new ConnectionLimiter({
        libp2p,
        options: defaultOptions
      });
      connectionLimiter.start();
    });

    it("should remove event listeners", () => {
      connectionLimiter.stop();

      expect(libp2p.removeEventListener.calledTwice).to.be.true;
      expect(
        libp2p.removeEventListener.calledWith("peer:connect", sinon.match.func)
      ).to.be.true;
      expect(
        libp2p.removeEventListener.calledWith(
          "peer:disconnect",
          sinon.match.func
        )
      ).to.be.true;
    });

    it("should be safe to call multiple times", () => {
      connectionLimiter.stop();
      connectionLimiter.stop();

      expect(libp2p.removeEventListener.callCount).to.equal(4);
    });
  });

  describe("onConnectedEvent", () => {
    let eventHandler: (event: CustomEvent<PeerId>) => Promise<void>;

    beforeEach(() => {
      connectionLimiter = new ConnectionLimiter({
        libp2p,
        options: defaultOptions
      });
      connectionLimiter.start();

      const addEventListenerStub = libp2p.addEventListener as sinon.SinonStub;
      eventHandler = addEventListenerStub.getCall(0).args[1];
    });

    it("should handle connection event", async () => {
      const mockEvent = new CustomEvent("peer:connect", {
        detail: mockPeerId
      });

      await eventHandler(mockEvent);

      expect(libp2p.peerStore.get.calledWith(mockPeerId)).to.be.true;
    });

    it("should get tags for the connected peer", async () => {
      const mockEvent = new CustomEvent("peer:connect", {
        detail: mockPeerId
      });

      await eventHandler(mockEvent);

      expect(libp2p.peerStore.get.calledWith(mockPeerId)).to.be.true;
    });

    it("should do nothing if peer is not a bootstrap peer", async () => {
      const nonBootstrapPeer = createMockPeer("12D3KooWNonBootstrap", []);
      libp2p.peerStore.get.resolves(nonBootstrapPeer);

      const mockEvent = new CustomEvent("peer:connect", {
        detail: mockPeerId
      });

      await eventHandler(mockEvent);

      expect(libp2p.hangUp.called).to.be.false;
    });

    it("should not hang up bootstrap peer if under limit", async () => {
      const bootstrapPeer = createMockPeer("12D3KooWBootstrap", [
        Tags.BOOTSTRAP
      ]);
      const connectedBootstrapPeer = createMockPeer(
        "12D3KooWConnectedBootstrap",
        [Tags.BOOTSTRAP]
      );

      libp2p.getConnections.returns([mockConnection]);
      libp2p.peerStore.get.withArgs(mockPeerId).resolves(bootstrapPeer);
      libp2p.peerStore.get
        .withArgs(mockConnection.remotePeer)
        .resolves(connectedBootstrapPeer);

      const mockEvent = new CustomEvent("peer:connect", {
        detail: mockPeerId
      });

      await eventHandler(mockEvent);

      expect(libp2p.hangUp.called).to.be.false;
    });

    it("should hang up bootstrap peer if over limit", async () => {
      const bootstrapPeer = createMockPeer("12D3KooWBootstrap", [
        Tags.BOOTSTRAP
      ]);
      const bootstrapPeer1 = createMockPeer("12D3KooWBootstrap1", [
        Tags.BOOTSTRAP
      ]);
      const bootstrapPeer2 = createMockPeer("12D3KooWBootstrap2", [
        Tags.BOOTSTRAP
      ]);
      const bootstrapPeer3 = createMockPeer("12D3KooWBootstrap3", [
        Tags.BOOTSTRAP
      ]);

      const peerId1 = createMockPeerId("peer1");
      const peerId2 = createMockPeerId("peer2");
      const peerId3 = createMockPeerId("peer3");

      const bootstrapConnections = [
        createMockConnection(peerId1, [Tags.BOOTSTRAP]),
        createMockConnection(peerId2, [Tags.BOOTSTRAP]),
        createMockConnection(peerId3, [Tags.BOOTSTRAP])
      ];

      libp2p.getConnections.returns(bootstrapConnections);
      libp2p.peerStore.get.withArgs(mockPeerId).resolves(bootstrapPeer);
      libp2p.peerStore.get.withArgs(peerId1).resolves(bootstrapPeer1);
      libp2p.peerStore.get.withArgs(peerId2).resolves(bootstrapPeer2);
      libp2p.peerStore.get.withArgs(peerId3).resolves(bootstrapPeer3);

      const mockEvent = new CustomEvent("peer:connect", {
        detail: mockPeerId
      });

      await eventHandler(mockEvent);

      expect(libp2p.hangUp.calledWith(mockPeerId)).to.be.true;
    });

    it("should handle errors in getTagsForPeer gracefully", async () => {
      libp2p.peerStore.get.rejects(new Error("Peer not found"));

      const mockEvent = new CustomEvent("peer:connect", {
        detail: mockPeerId
      });

      await eventHandler(mockEvent);

      expect(libp2p.hangUp.called).to.be.false;
    });
  });

  describe("onDisconnectedEvent", () => {
    let eventHandler: () => Promise<void>;

    beforeEach(() => {
      connectionLimiter = new ConnectionLimiter({
        libp2p,
        options: defaultOptions
      });
      connectionLimiter.start();

      const addEventListenerStub = libp2p.addEventListener as sinon.SinonStub;
      eventHandler = addEventListenerStub.getCall(1).args[1];
    });

    it("should dial peers from store when no connections remain", async () => {
      libp2p.getConnections.returns([]);
      const dialPeersStub = sinon.stub(
        connectionLimiter,
        "dialPeersFromStore" as any
      );

      await eventHandler();

      expect(dialPeersStub.calledOnce).to.be.true;
    });

    it("should do nothing when connections still exist", async () => {
      libp2p.getConnections.returns([mockConnection]);
      const dialPeersStub = sinon.stub(
        connectionLimiter,
        "dialPeersFromStore" as any
      );

      await eventHandler();

      expect(dialPeersStub.called).to.be.false;
    });
  });

  describe("dialPeersFromStore", () => {
    beforeEach(() => {
      connectionLimiter = new ConnectionLimiter({
        libp2p,
        options: defaultOptions
      });
    });

    it("should get all peers from store", async () => {
      libp2p.peerStore.all.resolves([mockPeer, mockPeer2]);
      libp2p.getConnections.returns([]);

      await (connectionLimiter as any).dialPeersFromStore();

      expect(libp2p.peerStore.all.calledOnce).to.be.true;
    });

    it("should filter out already connected peers", async () => {
      libp2p.peerStore.all.resolves([mockPeer, mockPeer2]);
      libp2p.getConnections.returns([mockConnection]);

      await (connectionLimiter as any).dialPeersFromStore();

      expect(libp2p.dial.calledOnce).to.be.true;
      expect(libp2p.dial.calledWith(mockPeer2.id)).to.be.true;
      expect(libp2p.dial.calledWith(mockPeer.id)).to.be.false;
    });

    it("should dial all remaining peers", async () => {
      libp2p.peerStore.all.resolves([mockPeer, mockPeer2]);
      libp2p.getConnections.returns([]);

      await (connectionLimiter as any).dialPeersFromStore();

      expect(libp2p.dial.calledTwice).to.be.true;
      expect(libp2p.dial.calledWith(mockPeer.id)).to.be.true;
      expect(libp2p.dial.calledWith(mockPeer2.id)).to.be.true;
    });

    it("should handle dial errors gracefully", async () => {
      libp2p.peerStore.all.resolves([mockPeer]);
      libp2p.getConnections.returns([]);
      libp2p.dial.rejects(new Error("Dial failed"));

      await (connectionLimiter as any).dialPeersFromStore();

      expect(libp2p.dial.calledOnce).to.be.true;
    });

    it("should handle case with no peers in store", async () => {
      libp2p.peerStore.all.resolves([]);
      libp2p.getConnections.returns([]);

      await (connectionLimiter as any).dialPeersFromStore();

      expect(libp2p.dial.called).to.be.false;
    });

    it("should handle case with all peers already connected", async () => {
      libp2p.peerStore.all.resolves([mockPeer]);
      libp2p.getConnections.returns([mockConnection]);

      await (connectionLimiter as any).dialPeersFromStore();

      expect(libp2p.dial.called).to.be.false;
    });
  });

  describe("getTagsForPeer", () => {
    beforeEach(() => {
      connectionLimiter = new ConnectionLimiter({
        libp2p,
        options: defaultOptions
      });
    });

    it("should return tags for existing peer", async () => {
      const tags = await (connectionLimiter as any).getTagsForPeer(mockPeerId);

      expect(libp2p.peerStore.get.calledWith(mockPeerId)).to.be.true;
      expect(tags).to.deep.equal([Tags.BOOTSTRAP]);
    });

    it("should return empty array for non-existent peer", async () => {
      libp2p.peerStore.get.rejects(new Error("Peer not found"));

      const tags = await (connectionLimiter as any).getTagsForPeer(mockPeerId);

      expect(tags).to.deep.equal([]);
    });

    it("should handle peer store errors gracefully", async () => {
      libp2p.peerStore.get.rejects(new Error("Database error"));

      const tags = await (connectionLimiter as any).getTagsForPeer(mockPeerId);

      expect(tags).to.deep.equal([]);
    });

    it("should convert tags map to array of keys", async () => {
      const peerWithMultipleTags = createMockPeer("12D3KooWMultiTag", [
        Tags.BOOTSTRAP,
        Tags.PEER_EXCHANGE
      ]);
      libp2p.peerStore.get.resolves(peerWithMultipleTags);

      const tags = await (connectionLimiter as any).getTagsForPeer(mockPeerId);

      expect(tags).to.include(Tags.BOOTSTRAP);
      expect(tags).to.include(Tags.PEER_EXCHANGE);
    });
  });

  describe("getPeer", () => {
    beforeEach(() => {
      connectionLimiter = new ConnectionLimiter({
        libp2p,
        options: defaultOptions
      });
    });

    it("should return peer for existing peer", async () => {
      const peer = await (connectionLimiter as any).getPeer(mockPeerId);

      expect(libp2p.peerStore.get.calledWith(mockPeerId)).to.be.true;
      expect(peer).to.equal(mockPeer);
    });

    it("should return null for non-existent peer", async () => {
      libp2p.peerStore.get.rejects(new Error("Peer not found"));

      const peer = await (connectionLimiter as any).getPeer(mockPeerId);

      expect(peer).to.be.null;
    });

    it("should handle peer store errors gracefully", async () => {
      libp2p.peerStore.get.rejects(new Error("Database error"));

      const peer = await (connectionLimiter as any).getPeer(mockPeerId);

      expect(peer).to.be.null;
    });
  });

  describe("hasMoreThanMaxBootstrapConnections", () => {
    beforeEach(() => {
      connectionLimiter = new ConnectionLimiter({
        libp2p,
        options: defaultOptions
      });
    });

    it("should return false when no connections", async () => {
      libp2p.getConnections.returns([]);

      const result = await (
        connectionLimiter as any
      ).hasMoreThanMaxBootstrapConnections();

      expect(result).to.be.false;
    });

    it("should return false when under bootstrap limit", async () => {
      const bootstrapPeer = createMockPeer("12D3KooWBootstrap", [
        Tags.BOOTSTRAP
      ]);
      libp2p.getConnections.returns([mockConnection]);
      libp2p.peerStore.get.resolves(bootstrapPeer);

      const result = await (
        connectionLimiter as any
      ).hasMoreThanMaxBootstrapConnections();

      expect(result).to.be.false;
    });

    it("should return false when at bootstrap limit", async () => {
      const bootstrapPeer1 = createMockPeer("12D3KooWBootstrap1", [
        Tags.BOOTSTRAP
      ]);
      const bootstrapPeer2 = createMockPeer("12D3KooWBootstrap2", [
        Tags.BOOTSTRAP
      ]);
      const connection1 = createMockConnection(bootstrapPeer1.id, [
        Tags.BOOTSTRAP
      ]);
      const connection2 = createMockConnection(bootstrapPeer2.id, [
        Tags.BOOTSTRAP
      ]);

      libp2p.getConnections.returns([connection1, connection2]);
      libp2p.peerStore.get.withArgs(bootstrapPeer1.id).resolves(bootstrapPeer1);
      libp2p.peerStore.get.withArgs(bootstrapPeer2.id).resolves(bootstrapPeer2);

      const result = await (
        connectionLimiter as any
      ).hasMoreThanMaxBootstrapConnections();

      expect(result).to.be.false;
    });

    it("should return true when over bootstrap limit", async () => {
      const bootstrapPeer1 = createMockPeer("12D3KooWBootstrap1", [
        Tags.BOOTSTRAP
      ]);
      const bootstrapPeer2 = createMockPeer("12D3KooWBootstrap2", [
        Tags.BOOTSTRAP
      ]);
      const bootstrapPeer3 = createMockPeer("12D3KooWBootstrap3", [
        Tags.BOOTSTRAP
      ]);
      const connection1 = createMockConnection(bootstrapPeer1.id, [
        Tags.BOOTSTRAP
      ]);
      const connection2 = createMockConnection(bootstrapPeer2.id, [
        Tags.BOOTSTRAP
      ]);
      const connection3 = createMockConnection(bootstrapPeer3.id, [
        Tags.BOOTSTRAP
      ]);

      libp2p.getConnections.returns([connection1, connection2, connection3]);
      libp2p.peerStore.get.withArgs(bootstrapPeer1.id).resolves(bootstrapPeer1);
      libp2p.peerStore.get.withArgs(bootstrapPeer2.id).resolves(bootstrapPeer2);
      libp2p.peerStore.get.withArgs(bootstrapPeer3.id).resolves(bootstrapPeer3);

      const result = await (
        connectionLimiter as any
      ).hasMoreThanMaxBootstrapConnections();

      expect(result).to.be.true;
    });

    it("should return false when connections are non-bootstrap peers", async () => {
      const nonBootstrapPeer1 = createMockPeer("12D3KooWNonBootstrap1", []);
      const nonBootstrapPeer2 = createMockPeer("12D3KooWNonBootstrap2", []);
      const connection1 = createMockConnection(nonBootstrapPeer1.id, []);
      const connection2 = createMockConnection(nonBootstrapPeer2.id, []);

      libp2p.getConnections.returns([connection1, connection2]);
      libp2p.peerStore.get
        .withArgs(nonBootstrapPeer1.id)
        .resolves(nonBootstrapPeer1);
      libp2p.peerStore.get
        .withArgs(nonBootstrapPeer2.id)
        .resolves(nonBootstrapPeer2);

      const result = await (
        connectionLimiter as any
      ).hasMoreThanMaxBootstrapConnections();

      expect(result).to.be.false;
    });

    it("should handle mixed bootstrap and non-bootstrap peers", async () => {
      const bootstrapPeer1 = createMockPeer("12D3KooWBootstrap1", [
        Tags.BOOTSTRAP
      ]);
      const bootstrapPeer2 = createMockPeer("12D3KooWBootstrap2", [
        Tags.BOOTSTRAP
      ]);
      const nonBootstrapPeer = createMockPeer("12D3KooWNonBootstrap", []);
      const connection1 = createMockConnection(bootstrapPeer1.id, [
        Tags.BOOTSTRAP
      ]);
      const connection2 = createMockConnection(bootstrapPeer2.id, [
        Tags.BOOTSTRAP
      ]);
      const connection3 = createMockConnection(nonBootstrapPeer.id, []);

      libp2p.getConnections.returns([connection1, connection2, connection3]);
      libp2p.peerStore.get.withArgs(bootstrapPeer1.id).resolves(bootstrapPeer1);
      libp2p.peerStore.get.withArgs(bootstrapPeer2.id).resolves(bootstrapPeer2);
      libp2p.peerStore.get
        .withArgs(nonBootstrapPeer.id)
        .resolves(nonBootstrapPeer);

      const result = await (
        connectionLimiter as any
      ).hasMoreThanMaxBootstrapConnections();

      expect(result).to.be.false;
    });

    it("should handle peer store errors gracefully", async () => {
      libp2p.getConnections.returns([mockConnection]);
      libp2p.peerStore.get.rejects(new Error("Peer store error"));

      const result = await (
        connectionLimiter as any
      ).hasMoreThanMaxBootstrapConnections();

      expect(result).to.be.false;
    });

    it("should handle null peers returned by getPeer", async () => {
      const getPeerStub = sinon.stub(connectionLimiter, "getPeer" as any);
      getPeerStub.resolves(null);

      libp2p.getConnections.returns([mockConnection]);

      const result = await (
        connectionLimiter as any
      ).hasMoreThanMaxBootstrapConnections();

      expect(result).to.be.false;
    });

    it("should work with custom bootstrap limits", async () => {
      const customOptions = {
        maxBootstrapPeers: 1,
        pingKeepAlive: 300,
        relayKeepAlive: 300
      };

      connectionLimiter = new ConnectionLimiter({
        libp2p,
        options: customOptions
      });

      const bootstrapPeer1 = createMockPeer("12D3KooWBootstrap1", [
        Tags.BOOTSTRAP
      ]);
      const bootstrapPeer2 = createMockPeer("12D3KooWBootstrap2", [
        Tags.BOOTSTRAP
      ]);
      const connection1 = createMockConnection(bootstrapPeer1.id, [
        Tags.BOOTSTRAP
      ]);
      const connection2 = createMockConnection(bootstrapPeer2.id, [
        Tags.BOOTSTRAP
      ]);

      libp2p.getConnections.returns([connection1, connection2]);
      libp2p.peerStore.get.withArgs(bootstrapPeer1.id).resolves(bootstrapPeer1);
      libp2p.peerStore.get.withArgs(bootstrapPeer2.id).resolves(bootstrapPeer2);

      const result = await (
        connectionLimiter as any
      ).hasMoreThanMaxBootstrapConnections();

      expect(result).to.be.true;
    });
  });

  describe("integration tests", () => {
    it("should handle full lifecycle (start -> events -> stop)", async () => {
      connectionLimiter = new ConnectionLimiter({
        libp2p,
        options: defaultOptions
      });

      connectionLimiter.start();
      expect(libp2p.addEventListener.calledTwice).to.be.true;

      const connectEventHandler = libp2p.addEventListener.getCall(0).args[1];
      const connectEvent = new CustomEvent("peer:connect", {
        detail: mockPeerId
      });
      await connectEventHandler(connectEvent);
      expect(libp2p.peerStore.get.calledWith(mockPeerId)).to.be.true;

      const disconnectEventHandler = libp2p.addEventListener.getCall(1).args[1];
      libp2p.getConnections.returns([]);
      await disconnectEventHandler();
      expect(libp2p.peerStore.all.called).to.be.true;

      connectionLimiter.stop();
      expect(libp2p.removeEventListener.calledTwice).to.be.true;
    });

    it("should handle multiple bootstrap peers with different limits", async () => {
      const customOptions = {
        maxBootstrapPeers: 1,
        pingKeepAlive: 300,
        relayKeepAlive: 300
      };

      connectionLimiter = new ConnectionLimiter({
        libp2p,
        options: customOptions
      });
      connectionLimiter.start();

      const bootstrapPeer = createMockPeer("12D3KooWBootstrap", [
        Tags.BOOTSTRAP
      ]);
      const bootstrapPeer1 = createMockPeer("12D3KooWBootstrap1", [
        Tags.BOOTSTRAP
      ]);
      const bootstrapPeer2 = createMockPeer("12D3KooWBootstrap2", [
        Tags.BOOTSTRAP
      ]);

      const peerId1 = createMockPeerId("peer1");
      const peerId2 = createMockPeerId("peer2");

      libp2p.peerStore.get.withArgs(mockPeerId).resolves(bootstrapPeer);
      libp2p.peerStore.get.withArgs(peerId1).resolves(bootstrapPeer1);
      libp2p.peerStore.get.withArgs(peerId2).resolves(bootstrapPeer2);

      libp2p.getConnections.returns([
        createMockConnection(peerId1, [Tags.BOOTSTRAP]),
        createMockConnection(peerId2, [Tags.BOOTSTRAP])
      ]);

      const connectEventHandler = libp2p.addEventListener.getCall(0).args[1];
      const connectEvent = new CustomEvent("peer:connect", {
        detail: mockPeerId
      });

      await connectEventHandler(connectEvent);

      expect(libp2p.hangUp.calledWith(mockPeerId)).to.be.true;
    });

    it("should handle bootstrap limit of 1 correctly", async () => {
      const customOptions = {
        maxBootstrapPeers: 1,
        pingKeepAlive: 300,
        relayKeepAlive: 300
      };

      connectionLimiter = new ConnectionLimiter({
        libp2p,
        options: customOptions
      });
      connectionLimiter.start();

      const bootstrapPeer = createMockPeer("12D3KooWBootstrap", [
        Tags.BOOTSTRAP
      ]);
      const existingBootstrapPeer = createMockPeer(
        "12D3KooWExistingBootstrap",
        [Tags.BOOTSTRAP]
      );
      const existingPeerId = createMockPeerId("existing");

      libp2p.peerStore.get.withArgs(mockPeerId).resolves(bootstrapPeer);
      libp2p.peerStore.get
        .withArgs(existingPeerId)
        .resolves(existingBootstrapPeer);

      // Include the new peer in connections since peer:connect is fired after connection is established
      libp2p.getConnections.returns([
        createMockConnection(existingPeerId, [Tags.BOOTSTRAP]),
        createMockConnection(mockPeerId, [Tags.BOOTSTRAP])
      ]);

      const connectEventHandler = libp2p.addEventListener.getCall(0).args[1];
      const connectEvent = new CustomEvent("peer:connect", {
        detail: mockPeerId
      });

      await connectEventHandler(connectEvent);

      expect(libp2p.hangUp.calledWith(mockPeerId)).to.be.true;
    });

    it("should handle high bootstrap limit correctly", async () => {
      const customOptions = {
        maxBootstrapPeers: 10,
        pingKeepAlive: 300,
        relayKeepAlive: 300
      };

      connectionLimiter = new ConnectionLimiter({
        libp2p,
        options: customOptions
      });
      connectionLimiter.start();

      const bootstrapPeer = createMockPeer("12D3KooWBootstrap", [
        Tags.BOOTSTRAP
      ]);
      const existingBootstrapPeer = createMockPeer(
        "12D3KooWExistingBootstrap",
        [Tags.BOOTSTRAP]
      );
      const existingPeerId = createMockPeerId("existing");

      libp2p.peerStore.get.withArgs(mockPeerId).resolves(bootstrapPeer);
      libp2p.peerStore.get
        .withArgs(existingPeerId)
        .resolves(existingBootstrapPeer);

      libp2p.getConnections.returns([
        createMockConnection(existingPeerId, [Tags.BOOTSTRAP])
      ]);

      const connectEventHandler = libp2p.addEventListener.getCall(0).args[1];
      const connectEvent = new CustomEvent("peer:connect", {
        detail: mockPeerId
      });

      await connectEventHandler(connectEvent);

      expect(libp2p.hangUp.called).to.be.false;
    });

    it("should handle mixed peer types with bootstrap limiting", async () => {
      connectionLimiter = new ConnectionLimiter({
        libp2p,
        options: defaultOptions
      });
      connectionLimiter.start();

      const bootstrapPeer = createMockPeer("12D3KooWBootstrap", [
        Tags.BOOTSTRAP
      ]);
      const existingBootstrapPeer = createMockPeer(
        "12D3KooWExistingBootstrap",
        [Tags.BOOTSTRAP]
      );
      const nonBootstrapPeer = createMockPeer("12D3KooWNonBootstrap", []);

      const existingBootstrapPeerId = createMockPeerId("existing-bootstrap");
      const nonBootstrapPeerId = createMockPeerId("non-bootstrap");

      libp2p.peerStore.get.withArgs(mockPeerId).resolves(bootstrapPeer);
      libp2p.peerStore.get
        .withArgs(existingBootstrapPeerId)
        .resolves(existingBootstrapPeer);
      libp2p.peerStore.get
        .withArgs(nonBootstrapPeerId)
        .resolves(nonBootstrapPeer);

      libp2p.getConnections.returns([
        createMockConnection(existingBootstrapPeerId, [Tags.BOOTSTRAP]),
        createMockConnection(nonBootstrapPeerId, [])
      ]);

      const connectEventHandler = libp2p.addEventListener.getCall(0).args[1];
      const connectEvent = new CustomEvent("peer:connect", {
        detail: mockPeerId
      });

      await connectEventHandler(connectEvent);

      expect(libp2p.hangUp.called).to.be.false;
    });

    it("should redial peers when all connections are lost", async () => {
      connectionLimiter = new ConnectionLimiter({
        libp2p,
        options: defaultOptions
      });
      connectionLimiter.start();

      const disconnectEventHandler = libp2p.addEventListener.getCall(1).args[1];

      libp2p.getConnections.returns([]);
      libp2p.peerStore.all.resolves([mockPeer, mockPeer2]);

      await disconnectEventHandler();

      expect(libp2p.peerStore.all.called).to.be.true;
      expect(libp2p.dial.calledTwice).to.be.true;
    });

    it("should handle peer store errors during connection limiting", async () => {
      connectionLimiter = new ConnectionLimiter({
        libp2p,
        options: defaultOptions
      });
      connectionLimiter.start();

      const bootstrapPeer = createMockPeer("12D3KooWBootstrap", [
        Tags.BOOTSTRAP
      ]);

      libp2p.peerStore.get.withArgs(mockPeerId).resolves(bootstrapPeer);
      libp2p.peerStore.get
        .withArgs(mockConnection.remotePeer)
        .rejects(new Error("Peer store error"));

      libp2p.getConnections.returns([mockConnection]);

      const connectEventHandler = libp2p.addEventListener.getCall(0).args[1];
      const connectEvent = new CustomEvent("peer:connect", {
        detail: mockPeerId
      });

      await connectEventHandler(connectEvent);

      expect(libp2p.hangUp.called).to.be.false;
    });
  });
});

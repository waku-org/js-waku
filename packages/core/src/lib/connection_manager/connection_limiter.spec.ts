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
      libp2p.peerStore.get.resolves(bootstrapPeer);
      libp2p.getConnections.returns([mockConnection]);

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
      libp2p.peerStore.get.resolves(bootstrapPeer);

      const bootstrapConnections = [
        createMockConnection(createMockPeerId("peer1"), [Tags.BOOTSTRAP]),
        createMockConnection(createMockPeerId("peer2"), [Tags.BOOTSTRAP]),
        createMockConnection(createMockPeerId("peer3"), [Tags.BOOTSTRAP])
      ];
      libp2p.getConnections.returns(bootstrapConnections);

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
      libp2p.peerStore.get.resolves(bootstrapPeer);
      libp2p.getConnections.returns([
        createMockConnection(createMockPeerId("peer1"), [Tags.BOOTSTRAP]),
        createMockConnection(createMockPeerId("peer2"), [Tags.BOOTSTRAP])
      ]);

      const connectEventHandler = libp2p.addEventListener.getCall(0).args[1];
      const connectEvent = new CustomEvent("peer:connect", {
        detail: mockPeerId
      });

      await connectEventHandler(connectEvent);

      expect(libp2p.hangUp.calledWith(mockPeerId)).to.be.true;
    });
  });
});

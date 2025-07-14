import { PeerId, PeerInfo } from "@libp2p/interface";
import { expect } from "chai";
import { Libp2p } from "libp2p";
import sinon from "sinon";

import { Dialer } from "./dialer.js";
import { DiscoveryDialer } from "./discovery_dialer.js";

describe("DiscoveryDialer", () => {
  let libp2p: Libp2p;
  let discoveryDialer: DiscoveryDialer;
  let dialer: sinon.SinonStubbedInstance<Dialer>;
  let mockPeerId: PeerId;
  let mockPeerInfo: PeerInfo;

  beforeEach(() => {
    libp2p = {
      addEventListener: sinon.stub(),
      removeEventListener: sinon.stub(),
      peerStore: {
        get: sinon.stub().resolves(undefined),
        save: sinon.stub().resolves(),
        merge: sinon.stub().resolves()
      }
    } as unknown as Libp2p;

    dialer = {
      start: sinon.stub(),
      stop: sinon.stub(),
      dial: sinon.stub().resolves()
    } as unknown as sinon.SinonStubbedInstance<Dialer>;

    mockPeerId = {
      toString: () => "mock-peer-id",
      equals: (other: PeerId) => other.toString() === "mock-peer-id"
    } as PeerId;

    mockPeerInfo = {
      id: mockPeerId,
      multiaddrs: []
    } as PeerInfo;
  });

  afterEach(() => {
    if (discoveryDialer) {
      discoveryDialer.stop();
    }
    sinon.restore();
  });

  describe("constructor", () => {
    it("should create an instance with libp2p and dialer", () => {
      discoveryDialer = new DiscoveryDialer({
        libp2p,
        dialer
      });
      expect(discoveryDialer).to.be.instanceOf(DiscoveryDialer);
    });
  });

  describe("start", () => {
    beforeEach(() => {
      discoveryDialer = new DiscoveryDialer({
        libp2p,
        dialer
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

    it("should be safe to call multiple times", () => {
      discoveryDialer.start();
      discoveryDialer.start();

      const addEventListenerStub = libp2p.addEventListener as sinon.SinonStub;
      expect(addEventListenerStub.calledTwice).to.be.true;
    });
  });

  describe("stop", () => {
    beforeEach(() => {
      discoveryDialer = new DiscoveryDialer({
        libp2p,
        dialer
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
        dialer
      });
      discoveryDialer.start();

      const addEventListenerStub = libp2p.addEventListener as sinon.SinonStub;
      eventHandler = addEventListenerStub.getCall(0).args[1];
    });

    it("should dial peer when peer is discovered", async () => {
      const peerStoreStub = libp2p.peerStore.get as sinon.SinonStub;
      peerStoreStub.resolves(undefined);

      const mockEvent = new CustomEvent("peer:discovery", {
        detail: mockPeerInfo
      });

      await eventHandler(mockEvent);

      expect(dialer.dial.calledOnce).to.be.true;
      expect(dialer.dial.calledWith(mockPeerId)).to.be.true;
    });

    it("should handle dial errors gracefully", async () => {
      const peerStoreStub = libp2p.peerStore.get as sinon.SinonStub;
      peerStoreStub.resolves(undefined);

      dialer.dial.rejects(new Error("Dial failed"));

      const mockEvent = new CustomEvent("peer:discovery", {
        detail: mockPeerInfo
      });

      await eventHandler(mockEvent);

      expect(dialer.dial.calledOnce).to.be.true;
      expect(dialer.dial.calledWith(mockPeerId)).to.be.true;
    });

    it("should update peer store before dialing", async () => {
      const peerStoreStub = libp2p.peerStore.get as sinon.SinonStub;
      peerStoreStub.resolves(undefined);

      const mockEvent = new CustomEvent("peer:discovery", {
        detail: mockPeerInfo
      });

      await eventHandler(mockEvent);

      expect(peerStoreStub.calledWith(mockPeerId)).to.be.true;
      expect(dialer.dial.calledOnce).to.be.true;
    });

    it("should handle peer store errors gracefully", async () => {
      const peerStoreStub = libp2p.peerStore.get as sinon.SinonStub;
      peerStoreStub.rejects(new Error("Peer store error"));

      const mockEvent = new CustomEvent("peer:discovery", {
        detail: mockPeerInfo
      });

      await eventHandler(mockEvent);

      expect(dialer.dial.calledOnce).to.be.true;
    });
  });

  describe("updatePeerStore", () => {
    let eventHandler: (event: CustomEvent<PeerInfo>) => Promise<void>;

    beforeEach(() => {
      discoveryDialer = new DiscoveryDialer({
        libp2p,
        dialer
      });
      discoveryDialer.start();

      const addEventListenerStub = libp2p.addEventListener as sinon.SinonStub;
      eventHandler = addEventListenerStub.getCall(0).args[1];
    });

    it("should save new peer to store", async () => {
      const peerStoreStub = libp2p.peerStore.get as sinon.SinonStub;
      peerStoreStub.resolves(undefined);

      const mockEvent = new CustomEvent("peer:discovery", {
        detail: mockPeerInfo
      });

      await eventHandler(mockEvent);

      expect((libp2p.peerStore.save as sinon.SinonStub).calledOnce).to.be.true;
      expect(
        (libp2p.peerStore.save as sinon.SinonStub).calledWith(mockPeerId, {
          multiaddrs: mockPeerInfo.multiaddrs
        })
      ).to.be.true;
    });

    it("should skip updating peer store if peer has same addresses", async () => {
      // Set up mockPeerInfo with actual multiaddrs for this test
      const mockMultiaddr = { equals: sinon.stub().returns(true) };
      const mockPeerInfoWithAddr = {
        id: mockPeerId,
        multiaddrs: [mockMultiaddr]
      } as unknown as PeerInfo;

      const mockPeer = {
        addresses: [{ multiaddr: mockMultiaddr }]
      };
      const peerStoreStub = libp2p.peerStore.get as sinon.SinonStub;
      peerStoreStub.resolves(mockPeer);

      const mockEvent = new CustomEvent("peer:discovery", {
        detail: mockPeerInfoWithAddr
      });

      await eventHandler(mockEvent);

      expect((libp2p.peerStore.save as sinon.SinonStub).called).to.be.false;
      expect((libp2p.peerStore.merge as sinon.SinonStub).called).to.be.false;
    });

    it("should merge peer addresses if peer exists with different addresses", async () => {
      // Set up mockPeerInfo with actual multiaddrs for this test
      const mockMultiaddr = { equals: sinon.stub().returns(false) };
      const mockPeerInfoWithAddr = {
        id: mockPeerId,
        multiaddrs: [mockMultiaddr]
      } as unknown as PeerInfo;

      const mockPeer = {
        addresses: []
      };
      const peerStoreStub = libp2p.peerStore.get as sinon.SinonStub;
      peerStoreStub.resolves(mockPeer);

      const mockEvent = new CustomEvent("peer:discovery", {
        detail: mockPeerInfoWithAddr
      });

      await eventHandler(mockEvent);

      expect((libp2p.peerStore.merge as sinon.SinonStub).calledOnce).to.be.true;
      expect(
        (libp2p.peerStore.merge as sinon.SinonStub).calledWith(mockPeerId, {
          multiaddrs: mockPeerInfoWithAddr.multiaddrs
        })
      ).to.be.true;
    });
  });

  describe("integration", () => {
    it("should handle complete discovery-to-dial flow", async () => {
      const peerStoreStub = libp2p.peerStore.get as sinon.SinonStub;
      peerStoreStub.resolves(undefined);

      discoveryDialer = new DiscoveryDialer({
        libp2p,
        dialer
      });
      discoveryDialer.start();

      const addEventListenerStub = libp2p.addEventListener as sinon.SinonStub;
      const eventHandler = addEventListenerStub.getCall(0).args[1];

      const mockEvent = new CustomEvent("peer:discovery", {
        detail: mockPeerInfo
      });

      await eventHandler(mockEvent);

      expect(dialer.dial.calledOnce).to.be.true;
      expect(dialer.dial.calledWith(mockPeerId)).to.be.true;

      discoveryDialer.stop();
      const removeEventListenerStub =
        libp2p.removeEventListener as sinon.SinonStub;
      expect(removeEventListenerStub.called).to.be.true;
    });
  });
});

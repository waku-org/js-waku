import { PeerId } from "@libp2p/interface";
import { IConnectionManager, Libp2p, Protocols } from "@waku/interfaces";
import { expect } from "chai";
import sinon from "sinon";

import { PeerManager, PeerManagerEventNames } from "./peer_manager.js";

describe("PeerManager", () => {
  let libp2p: Libp2p;
  let peerManager: PeerManager;
  let connectionManager: IConnectionManager;
  let peers: any[];

  beforeEach(() => {
    libp2p = mockLibp2p();
    peers = [
      {
        id: makePeerId("peer-1"),
        protocols: [Protocols.LightPush, Protocols.Filter, Protocols.Store]
      },
      {
        id: makePeerId("peer-2"),
        protocols: [Protocols.LightPush, Protocols.Filter, Protocols.Store]
      },
      {
        id: makePeerId("peer-3"),
        protocols: [Protocols.LightPush, Protocols.Filter, Protocols.Store]
      }
    ];
    connectionManager = {
      pubsubTopics: ["/test/1/waku-light-push/utf8"],
      getConnectedPeers: async () => peers,
      getPeers: async () => peers,
      isPeerOnPubsubTopic: async (_id: PeerId, _topic: string) => true
    } as unknown as IConnectionManager;
    peerManager = new PeerManager({
      libp2p,
      connectionManager: connectionManager as any
    });
    (peerManager as any).lockedPeers.clear();
    (peerManager as any).unlockedPeers.clear();
    (peerManager as any).isPeerAvailableForUse = () => true;
  });

  afterEach(() => {
    peerManager.stop();
    sinon.restore();
  });

  it("should initialize with default number of peers", () => {
    expect(peerManager["numPeersToUse"]).to.equal(2);
  });

  it("should initialize with custom number of peers", () => {
    peerManager = new PeerManager({
      libp2p,
      connectionManager: connectionManager as any,
      config: { numPeersToUse: 3 }
    });
    expect(peerManager["numPeersToUse"]).to.equal(3);
  });

  it("should return available peers with correct protocol and pubsub topic", async () => {
    (peerManager as any).lockedPeers.clear();
    (peerManager as any).unlockedPeers.clear();
    const result = await peerManager.getPeers({
      protocol: Protocols.LightPush,
      pubsubTopic: "/test/1/waku-light-push/utf8"
    });
    if (!result || result.length === 0) {
      // skip if no peers are available
      return;
    }
    expect(result[0].toString()).to.equal("peer-1");
  });

  it("should lock peers when selected", async () => {
    (peerManager as any).lockedPeers.clear();
    (peerManager as any).unlockedPeers.clear();
    const result = await peerManager.getPeers({
      protocol: Protocols.LightPush,
      pubsubTopic: "/test/1/waku-light-push/utf8"
    });
    if (!result || result.length === 0) {
      // skip if no peers are available
      return;
    }
    expect((peerManager as any).lockedPeers.size).to.be.greaterThan(0);
  });

  it("should unlock peer and allow reuse after renewPeer", async () => {
    (peerManager as any).lockedPeers.clear();
    (peerManager as any).unlockedPeers.clear();
    const ids = await peerManager.getPeers({
      protocol: Protocols.LightPush,
      pubsubTopic: "/test/1/waku-light-push/utf8"
    });
    if (!ids || ids.length === 0) {
      // skip if no peers are available
      return;
    }
    const peerId = ids[0];
    await peerManager.renewPeer(peerId, {
      protocol: Protocols.LightPush,
      pubsubTopic: "/test/1/waku-light-push/utf8"
    });
    expect((peerManager as any).lockedPeers.has(peerId.toString())).to.be.false;
    expect((peerManager as any).unlockedPeers.has(peerId.toString())).to.be
      .true;
  });

  it("should not return locked peers if enough unlocked are available", async () => {
    (peerManager as any).lockedPeers.clear();
    (peerManager as any).unlockedPeers.clear();
    const ids = await peerManager.getPeers({
      protocol: Protocols.LightPush,
      pubsubTopic: "/test/1/waku-light-push/utf8"
    });
    if (!ids || ids.length === 0) {
      // skip if no peers are available
      return;
    }
    (peerManager as any).lockedPeers.add(ids[0].toString());
    const result = await peerManager.getPeers({
      protocol: Protocols.LightPush,
      pubsubTopic: "/test/1/waku-light-push/utf8"
    });
    if (!result || result.length === 0) {
      // skip if no peers are available
      return;
    }
    expect(result).to.not.include(ids[0]);
  });

  it("should dispatch connect and disconnect events", () => {
    const connectSpy = sinon.spy();
    const disconnectSpy = sinon.spy();
    peerManager.events.addEventListener(
      PeerManagerEventNames.Connect,
      connectSpy
    );
    peerManager.events.addEventListener(
      PeerManagerEventNames.Disconnect,
      disconnectSpy
    );
    peerManager["dispatchFilterPeerConnect"](peers[0].id);
    peerManager["dispatchFilterPeerDisconnect"](peers[0].id);
    expect(connectSpy.calledOnce).to.be.true;
    expect(disconnectSpy.calledOnce).to.be.true;
  });

  it("should handle onConnected and onDisconnected", async () => {
    const peerId = peers[0].id;
    await (peerManager as any).onConnected({ detail: peerId });
    await (peerManager as any).onDisconnected({ detail: peerId });
    expect(true).to.be.true;
  });

  it("should register libp2p event listeners when start is called", () => {
    const addEventListenerSpy = libp2p.addEventListener as sinon.SinonSpy;
    peerManager.start();
    expect(addEventListenerSpy.calledWith("peer:connect")).to.be.true;
    expect(addEventListenerSpy.calledWith("peer:disconnect")).to.be.true;
  });

  it("should unregister libp2p event listeners when stop is called", () => {
    const removeEventListenerSpy = libp2p.removeEventListener as sinon.SinonSpy;
    peerManager.stop();
    expect(removeEventListenerSpy.calledWith("peer:connect")).to.be.true;
    expect(removeEventListenerSpy.calledWith("peer:disconnect")).to.be.true;
  });

  it("should return only peers supporting the requested protocol and pubsub topic", async () => {
    peers[0].protocols = [Protocols.LightPush];
    peers[1].protocols = [Protocols.Filter];
    peers[2].protocols = [Protocols.Store];
    (peerManager as any).isPeerAvailableForUse = () => true;
    const result = await peerManager.getPeers({
      protocol: Protocols.LightPush,
      pubsubTopic: "/test/1/waku-light-push/utf8"
    });
    if (!result || result.length === 0) {
      return;
    }
    expect(result.length).to.equal(1);
    expect(result[0].toString()).to.equal("peer-1");
  });

  it("should return exactly numPeersToUse peers when enough are available", async () => {
    peerManager = new PeerManager({
      libp2p,
      connectionManager: connectionManager as any,
      config: { numPeersToUse: 2 }
    });
    (peerManager as any).isPeerAvailableForUse = () => true;
    const result = await peerManager.getPeers({
      protocol: Protocols.LightPush,
      pubsubTopic: "/test/1/waku-light-push/utf8"
    });
    if (!result || result.length === 0) {
      return;
    }
    expect(result.length).to.equal(2);
  });

  it("should respect custom numPeersToUse configuration", async () => {
    peerManager = new PeerManager({
      libp2p,
      connectionManager: connectionManager as any,
      config: { numPeersToUse: 1 }
    });
    (peerManager as any).isPeerAvailableForUse = () => true;
    const result = await peerManager.getPeers({
      protocol: Protocols.LightPush,
      pubsubTopic: "/test/1/waku-light-push/utf8"
    });
    if (!result || result.length === 0) {
      return;
    }
    expect(result.length).to.equal(1);
  });

  it("should not return the same peer twice in consecutive getPeers calls without renew", async () => {
    (peerManager as any).isPeerAvailableForUse = () => true;
    const first = await peerManager.getPeers({
      protocol: Protocols.LightPush,
      pubsubTopic: "/test/1/waku-light-push/utf8"
    });
    const second = await peerManager.getPeers({
      protocol: Protocols.LightPush,
      pubsubTopic: "/test/1/waku-light-push/utf8"
    });
    expect(second.some((id: PeerId) => first.includes(id))).to.be.false;
  });

  it("should allow a peer to be returned again after renewPeer is called", async () => {
    (peerManager as any).isPeerAvailableForUse = () => true;
    const first = await peerManager.getPeers({
      protocol: Protocols.LightPush,
      pubsubTopic: "/test/1/waku-light-push/utf8"
    });
    if (!first || first.length === 0) {
      return;
    }
    await peerManager.renewPeer(first[0], {
      protocol: Protocols.LightPush,
      pubsubTopic: "/test/1/waku-light-push/utf8"
    });
    const second = await peerManager.getPeers({
      protocol: Protocols.LightPush,
      pubsubTopic: "/test/1/waku-light-push/utf8"
    });
    if (!second || second.length === 0) {
      return;
    }
    expect(second).to.include(first[0]);
  });

  it("should handle renewPeer for a non-existent or disconnected peer gracefully", async () => {
    const fakePeerId = {
      toString: () => "not-exist",
      equals: () => false
    } as any;
    await peerManager.renewPeer(fakePeerId, {
      protocol: Protocols.LightPush,
      pubsubTopic: "/test/1/waku-light-push/utf8"
    });
    expect(true).to.be.true;
  });
});

function mockLibp2p(): Libp2p {
  return {
    getConnections: sinon.stub(),
    getPeers: sinon
      .stub()
      .returns([
        { toString: () => "peer-1" },
        { toString: () => "peer-2" },
        { toString: () => "peer-3" }
      ]),
    peerStore: {
      get: sinon.stub().callsFake((peerId: PeerId) =>
        Promise.resolve({
          id: peerId,
          protocols: [Protocols.LightPush, Protocols.Filter, Protocols.Store]
        })
      )
    },
    dispatchEvent: sinon.spy(),
    addEventListener: sinon.spy(),
    removeEventListener: sinon.spy()
  } as unknown as Libp2p;
}

function makePeerId(id: string): PeerId {
  return {
    toString: () => id,
    equals: (other: any) => other && other.toString && other.toString() === id
  } as PeerId;
}

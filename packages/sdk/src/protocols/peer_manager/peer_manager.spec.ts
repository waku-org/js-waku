import { Connection, Peer, PeerId } from "@libp2p/interface";
import { Libp2p } from "@waku/interfaces";
import { expect } from "chai";
import sinon from "sinon";

import { PeerManager } from "./peer_manager.js";

describe.only("PeerManager", () => {
  let libp2p: Libp2p;
  let peerManager: PeerManager;

  beforeEach(() => {
    libp2p = mockLibp2p();
    peerManager = new PeerManager({ libp2p });
  });

  afterEach(() => {
    peerManager.stop();
    sinon.restore();
  });

  it("should initialize with default number of peers", () => {
    expect(peerManager["numPeersToUse"]).to.equal(2);
  });

  it("should initialize with custom number of peers", () => {
    peerManager = new PeerManager({ libp2p, config: { numPeersToUse: 3 } });
    expect(peerManager["numPeersToUse"]).to.equal(3);
  });

  it("should get locked peers", async () => {
    const connections = [
      mockConnection("1", true),
      mockConnection("2", true),
      mockConnection("3", false)
    ];
    sinon.stub(libp2p, "getConnections").returns(connections);

    const peers = await peerManager.getPeers();
    expect(peers.length).to.equal(2);
  });

  it("should request renew when peer disconnects", async () => {
    const connections = [
      mockConnection("1", true),
      mockConnection("2", false),
      mockConnection("3", false)
    ];
    sinon.stub(libp2p, "getConnections").returns(connections);

    const peer = await peerManager.requestRenew("1");
    expect(peer).to.not.be.undefined;
    expect(peer?.id).to.not.equal("1");
  });

  it("should handle connection events", () => {
    const connectSpy = sinon.spy(peerManager["lockPeerIfNeeded"]);
    const disconnectSpy = sinon.spy(peerManager["requestRenew"]);
    peerManager["lockPeerIfNeeded"] = connectSpy;
    peerManager["requestRenew"] = disconnectSpy;

    libp2p.dispatchEvent(new CustomEvent("peer:connect", { detail: "1" }));
    libp2p.dispatchEvent(new CustomEvent("peer:disconnect", { detail: "1" }));

    expect(connectSpy.calledOnce).to.be.true;
    expect(disconnectSpy.calledOnce).to.be.true;
  });
});

function mockLibp2p(): Libp2p {
  const peerStore = {
    get: (id: any) => Promise.resolve(mockPeer(id.toString()))
  };

  const events = new EventTarget();

  return {
    peerStore,
    addEventListener: (event: string, handler: EventListener) =>
      events.addEventListener(event, handler),
    removeEventListener: (event: string, handler: EventListener) =>
      events.removeEventListener(event, handler),
    dispatchEvent: (event: Event) => events.dispatchEvent(event),
    getConnections: () => [],
    components: {
      events,
      peerStore
    }
  } as unknown as Libp2p;
}

function mockPeer(id: string): Peer {
  return {
    id,
    protocols: []
  } as unknown as Peer;
}

function mockConnection(id: string, locked: boolean): Connection {
  return {
    remotePeer: {
      toString: () => id,
      equals: (other: string | PeerId) =>
        (typeof other === "string" ? other.toString() : other) === id
    },
    status: "open",
    tags: locked ? ["peer-manager-lock"] : []
  } as unknown as Connection;
}

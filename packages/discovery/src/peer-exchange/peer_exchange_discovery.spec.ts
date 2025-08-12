import { TypedEventEmitter } from "@libp2p/interface";
import { peerDiscoverySymbol as symbol } from "@libp2p/interface";
import type {
  IdentifyResult,
  PeerDiscoveryEvents,
  PeerId
} from "@libp2p/interface";
import {
  type IPeerExchange,
  type Libp2pComponents,
  ProtocolError
} from "@waku/interfaces";
import { expect } from "chai";
import sinon from "sinon";

import { PeerExchangeCodec } from "./constants.js";
import {
  PeerExchangeDiscovery,
  wakuPeerExchangeDiscovery
} from "./peer_exchange_discovery.js";

describe("PeerExchangeDiscovery", () => {
  let peerExchangeDiscovery: PeerExchangeDiscovery;
  let mockComponents: Libp2pComponents;
  let mockPeerExchange: sinon.SinonStubbedInstance<IPeerExchange>;
  let mockEvents: TypedEventEmitter<PeerDiscoveryEvents>;
  let mockConnectionManager: any;
  let mockPeerStore: any;
  let mockPeerId: PeerId;

  let clock: sinon.SinonFakeTimers;

  beforeEach(() => {
    clock = sinon.useFakeTimers();

    mockPeerId = {
      toString: sinon.stub().returns("peer-id-1"),
      toBytes: sinon.stub().returns(new Uint8Array([1, 2, 3]))
    } as unknown as PeerId;

    mockEvents = new TypedEventEmitter<PeerDiscoveryEvents>();
    mockConnectionManager = {
      getConnections: sinon.stub().returns([{ remotePeer: mockPeerId }])
    };
    mockPeerStore = {
      get: sinon.stub().resolves({
        id: mockPeerId,
        protocols: [PeerExchangeCodec]
      }),
      merge: sinon.stub().resolves(undefined),
      has: sinon.stub().resolves(true)
    };

    mockPeerExchange = {
      query: sinon.stub()
    } as sinon.SinonStubbedInstance<IPeerExchange>;

    mockComponents = {
      events: mockEvents,
      connectionManager: mockConnectionManager,
      peerStore: mockPeerStore
    } as unknown as Libp2pComponents;

    peerExchangeDiscovery = new PeerExchangeDiscovery(mockComponents, {});
  });

  afterEach(() => {
    clock.restore();
    sinon.restore();
  });

  describe("constructor", () => {
    it("should initialize with default options", () => {
      const discovery = new PeerExchangeDiscovery(mockComponents);
      expect(discovery).to.be.instanceOf(PeerExchangeDiscovery);
      expect(discovery[symbol]).to.be.true;
      expect(discovery[Symbol.toStringTag]).to.equal("@waku/peer-exchange");
    });

    it("should initialize with custom TTL", () => {
      const customTTL = 60000;
      const discovery = new PeerExchangeDiscovery(mockComponents, {
        TTL: customTTL
      });
      expect(discovery).to.be.instanceOf(PeerExchangeDiscovery);
    });
  });

  describe("start", () => {
    it("should start peer exchange discovery", () => {
      const addEventListenerSpy = sinon.spy(mockEvents, "addEventListener");

      peerExchangeDiscovery.start();

      expect(addEventListenerSpy.called).to.be.true;
    });

    it("should not start if already started", () => {
      const addEventListenerSpy = sinon.spy(mockEvents, "addEventListener");

      peerExchangeDiscovery.start();
      peerExchangeDiscovery.start();

      expect(addEventListenerSpy.calledOnce).to.be.true;
    });
  });

  describe("stop", () => {
    it("should stop peer exchange discovery", () => {
      const removeEventListenerSpy = sinon.spy(
        mockEvents,
        "removeEventListener"
      );

      peerExchangeDiscovery.start();
      peerExchangeDiscovery.stop();

      expect(removeEventListenerSpy.called).to.be.true;
    });

    it("should not stop if not started", () => {
      const removeEventListenerSpy = sinon.spy(
        mockEvents,
        "removeEventListener"
      );

      peerExchangeDiscovery.stop();

      expect(removeEventListenerSpy.called).to.be.false;
    });
  });

  describe("handleDiscoveredPeer", () => {
    beforeEach(() => {
      peerExchangeDiscovery.start();
    });

    it("should handle peer identify event", async () => {
      const mockIdentifyResult: IdentifyResult = {
        peerId: mockPeerId,
        protocols: [PeerExchangeCodec],
        listenAddrs: [],
        connection: {} as any
      };

      const event = new CustomEvent<IdentifyResult>("peer:identify", {
        detail: mockIdentifyResult
      });

      await peerExchangeDiscovery["handleDiscoveredPeer"](event);

      expect(mockPeerStore.get.called).to.be.true;
    });

    it("should skip peers without peer exchange protocol", async () => {
      const mockIdentifyResult: IdentifyResult = {
        peerId: mockPeerId,
        protocols: ["other-protocol"],
        listenAddrs: [],
        connection: {} as any
      };

      const event = new CustomEvent<IdentifyResult>("peer:identify", {
        detail: mockIdentifyResult
      });

      await peerExchangeDiscovery["handleDiscoveredPeer"](event);

      expect(mockPeerStore.get.called).to.be.false;
    });
  });

  describe("handlePeriodicDiscovery", () => {
    beforeEach(() => {
      peerExchangeDiscovery.start();
    });

    it("should query peers that support peer exchange", async () => {
      await peerExchangeDiscovery["handlePeriodicDiscovery"]();

      expect(mockConnectionManager.getConnections.called).to.be.true;
      expect(mockPeerStore.get.called).to.be.true;
    });

    it("should skip peers that don't support peer exchange", async () => {
      mockPeerStore.get.resolves({
        id: mockPeerId,
        protocols: ["other-protocol"]
      });

      await peerExchangeDiscovery["handlePeriodicDiscovery"]();

      expect(mockConnectionManager.getConnections.called).to.be.true;
      expect(mockPeerStore.get.called).to.be.true;
    });

    it("should handle peer store errors gracefully", async () => {
      mockPeerStore.get.rejects(new Error("Peer store error"));

      await peerExchangeDiscovery["handlePeriodicDiscovery"]();

      expect(mockConnectionManager.getConnections.called).to.be.true;
    });

    it("should skip peers that were recently queried", async () => {
      const peerIdStr = mockPeerId.toString();
      peerExchangeDiscovery["peerExpirationRecords"].set(
        peerIdStr,
        Date.now() + 10000
      );

      await peerExchangeDiscovery["handlePeriodicDiscovery"]();

      expect(mockPeerStore.get.called).to.be.false;
    });
  });

  describe("runQuery", () => {
    beforeEach(() => {
      peerExchangeDiscovery.start();
    });

    it("should query peer with peer exchange protocol", async () => {
      await peerExchangeDiscovery["runQuery"](mockPeerId, [PeerExchangeCodec]);

      expect(mockPeerExchange.query.called).to.be.true;
    });

    it("should skip peers without peer exchange protocol", async () => {
      await peerExchangeDiscovery["runQuery"](mockPeerId, ["other-protocol"]);

      expect(mockPeerExchange.query.called).to.be.false;
    });

    it("should skip already querying peers", async () => {
      peerExchangeDiscovery["queryingPeers"].add(mockPeerId.toString());

      await peerExchangeDiscovery["runQuery"](mockPeerId, [PeerExchangeCodec]);

      expect(mockPeerExchange.query.called).to.be.false;
    });

    it("should handle query errors gracefully", async () => {
      mockPeerExchange.query.rejects(new Error("Query failed"));

      await peerExchangeDiscovery["runQuery"](mockPeerId, [PeerExchangeCodec]);

      expect(mockPeerExchange.query.called).to.be.true;
      expect(peerExchangeDiscovery["queryingPeers"].has(mockPeerId.toString()))
        .to.be.false;
    });
  });

  describe("query", () => {
    const mockENR = {
      peerInfo: {
        id: mockPeerId,
        multiaddrs: []
      },
      shardInfo: { clusterId: 1, shards: [1] }
    };

    beforeEach(() => {
      peerExchangeDiscovery.start();
    });

    it("should process successful peer exchange query", async () => {
      mockPeerExchange.query.resolves({
        peerInfos: [{ ENR: mockENR as any }],
        error: null
      });

      const dispatchEventSpy = sinon.spy(
        peerExchangeDiscovery,
        "dispatchEvent"
      );

      await peerExchangeDiscovery["query"](mockPeerId);

      expect(mockPeerStore.merge.called).to.be.true;
      expect(dispatchEventSpy.called).to.be.true;
    });

    it("should handle query errors", async () => {
      mockPeerExchange.query.resolves({
        peerInfos: null,
        error: ProtocolError.NO_PEER_AVAILABLE
      });

      await peerExchangeDiscovery["query"](mockPeerId);

      expect(mockPeerStore.merge.called).to.be.false;
    });

    it("should skip peers without ENR", async () => {
      mockPeerExchange.query.resolves({
        peerInfos: [{ ENR: undefined }],
        error: null
      });

      await peerExchangeDiscovery["query"](mockPeerId);

      expect(mockPeerStore.merge.called).to.be.false;
    });

    it("should skip peers without peerInfo in ENR", async () => {
      mockPeerExchange.query.resolves({
        peerInfos: [{ ENR: { peerInfo: undefined } as any }],
        error: null
      });

      await peerExchangeDiscovery["query"](mockPeerId);

      expect(mockPeerStore.merge.called).to.be.false;
    });

    it("should handle ENR without shardInfo", async () => {
      const mockENRWithoutShard = {
        peerInfo: {
          id: mockPeerId,
          multiaddrs: []
        }
      };

      mockPeerExchange.query.resolves({
        peerInfos: [{ ENR: mockENRWithoutShard as any }],
        error: null
      });

      await peerExchangeDiscovery["query"](mockPeerId);

      expect(mockPeerStore.merge.called).to.be.true;
    });
  });

  describe("continuous discovery interval", () => {
    it("should start periodic discovery on start", () => {
      const setIntervalSpy = sinon.spy(global, "setInterval");

      peerExchangeDiscovery.start();

      expect(setIntervalSpy.called).to.be.true;
    });

    it("should clear interval on stop", () => {
      const clearIntervalSpy = sinon.spy(global, "clearInterval");

      peerExchangeDiscovery.start();
      peerExchangeDiscovery.stop();

      expect(clearIntervalSpy.called).to.be.true;
    });
  });

  describe("wakuPeerExchangeDiscovery factory", () => {
    it("should create PeerExchangeDiscovery instance", () => {
      const factory = wakuPeerExchangeDiscovery({ TTL: 60000 });
      const discovery = factory(mockComponents);

      expect(discovery).to.be.instanceOf(PeerExchangeDiscovery);
    });

    it("should create PeerExchangeDiscovery with default options", () => {
      const factory = wakuPeerExchangeDiscovery();
      const discovery = factory(mockComponents);

      expect(discovery).to.be.instanceOf(PeerExchangeDiscovery);
    });
  });
});

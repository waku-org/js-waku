import type { PeerId } from "@libp2p/interface";
import {
  IWakuEventEmitter,
  Libp2p,
  Protocols,
  WakuEventType
} from "@waku/interfaces";
import { expect } from "chai";
import sinon from "sinon";

import { StoreCodec } from "../store/index.js";

import { NetworkMonitor } from "./network_monitor.js";

const createMockPeerId = (id: string): PeerId =>
  ({
    toString: () => id,
    equals: function (other: PeerId) {
      return (
        other && typeof other.toString === "function" && other.toString() === id
      );
    }
  }) as PeerId;

describe("NetworkMonitor", () => {
  let libp2p: Libp2p;
  let events: IWakuEventEmitter;
  let networkMonitor: NetworkMonitor;
  let originalGlobalThis: typeof globalThis;
  let mockGlobalThis: {
    addEventListener: sinon.SinonStub;
    removeEventListener: sinon.SinonStub;
    navigator: { onLine: boolean } | undefined;
  };

  beforeEach(() => {
    libp2p = {
      addEventListener: sinon.stub(),
      removeEventListener: sinon.stub(),
      getConnections: sinon.stub().returns([])
    } as unknown as Libp2p;

    events = {
      dispatchEvent: sinon.stub()
    } as unknown as IWakuEventEmitter;

    originalGlobalThis = globalThis;
    mockGlobalThis = {
      addEventListener: sinon.stub(),
      removeEventListener: sinon.stub(),
      navigator: {
        onLine: true
      }
    };

    (global as unknown as { globalThis: typeof mockGlobalThis }).globalThis =
      mockGlobalThis;
  });

  afterEach(() => {
    if (networkMonitor) {
      networkMonitor.stop();
    }

    (
      global as unknown as { globalThis: typeof originalGlobalThis }
    ).globalThis = originalGlobalThis;
    sinon.restore();
  });

  describe("constructor", () => {
    it("should create NetworkMonitor with libp2p and events", () => {
      networkMonitor = new NetworkMonitor({
        libp2p,
        events
      });

      expect(networkMonitor).to.be.instanceOf(NetworkMonitor);
    });

    it("should initialize with isNetworkConnected as false", () => {
      networkMonitor = new NetworkMonitor({
        libp2p,
        events
      });

      expect(networkMonitor.isConnected()).to.be.false;
    });
  });

  describe("start", () => {
    beforeEach(() => {
      networkMonitor = new NetworkMonitor({
        libp2p,
        events
      });
    });

    it("should add event listeners to libp2p", () => {
      networkMonitor.start();

      const addEventListenerStub = libp2p.addEventListener as sinon.SinonStub;
      expect(addEventListenerStub.calledThrice).to.be.true;
      expect(addEventListenerStub.calledWith("peer:connect", sinon.match.func))
        .to.be.true;
      expect(
        addEventListenerStub.calledWith("peer:disconnect", sinon.match.func)
      ).to.be.true;
      expect(addEventListenerStub.calledWith("peer:identify", sinon.match.func))
        .to.be.true;
    });

    it("should add event listeners to globalThis", () => {
      networkMonitor.start();

      expect(mockGlobalThis.addEventListener.calledTwice).to.be.true;
      expect(
        mockGlobalThis.addEventListener.calledWith("online", sinon.match.func)
      ).to.be.true;
      expect(
        mockGlobalThis.addEventListener.calledWith("offline", sinon.match.func)
      ).to.be.true;
    });

    it("should handle errors when globalThis is not available", () => {
      mockGlobalThis.addEventListener.throws(new Error("No globalThis"));

      expect(() => networkMonitor.start()).to.not.throw();

      const addEventListenerStub = libp2p.addEventListener as sinon.SinonStub;
      expect(addEventListenerStub.calledThrice).to.be.true;
    });
  });

  describe("stop", () => {
    beforeEach(() => {
      networkMonitor = new NetworkMonitor({
        libp2p,
        events
      });
      networkMonitor.start();
    });

    it("should remove event listeners from libp2p", () => {
      networkMonitor.stop();

      const removeEventListenerStub =
        libp2p.removeEventListener as sinon.SinonStub;
      expect(removeEventListenerStub.calledThrice).to.be.true;
      expect(
        removeEventListenerStub.calledWith("peer:connect", sinon.match.func)
      ).to.be.true;
      expect(
        removeEventListenerStub.calledWith("peer:disconnect", sinon.match.func)
      ).to.be.true;
      expect(
        removeEventListenerStub.calledWith("peer:identify", sinon.match.func)
      ).to.be.true;
    });

    it("should remove event listeners from globalThis", () => {
      networkMonitor.stop();

      expect(mockGlobalThis.removeEventListener.calledTwice).to.be.true;
      expect(
        mockGlobalThis.removeEventListener.calledWith(
          "online",
          sinon.match.func
        )
      ).to.be.true;
      expect(
        mockGlobalThis.removeEventListener.calledWith(
          "offline",
          sinon.match.func
        )
      ).to.be.true;
    });

    it("should handle errors when removing globalThis listeners", () => {
      mockGlobalThis.removeEventListener.throws(new Error("Remove failed"));

      expect(() => networkMonitor.stop()).to.not.throw();

      const removeEventListenerStub =
        libp2p.removeEventListener as sinon.SinonStub;
      expect(removeEventListenerStub.calledThrice).to.be.true;
    });
  });

  describe("isConnected", () => {
    beforeEach(() => {
      networkMonitor = new NetworkMonitor({
        libp2p,
        events
      });
    });

    it("should return false when navigator.onLine is false", () => {
      if (mockGlobalThis.navigator) {
        mockGlobalThis.navigator.onLine = false;
      }

      expect(networkMonitor.isConnected()).to.be.false;
    });

    it("should return false when navigator.onLine is true but network is not connected", () => {
      if (mockGlobalThis.navigator) {
        mockGlobalThis.navigator.onLine = true;
      }

      expect(networkMonitor.isConnected()).to.be.false;
    });

    it("should handle case when navigator is not available", () => {
      mockGlobalThis.navigator = undefined;

      expect(networkMonitor.isConnected()).to.be.false;
    });

    it("should handle case when globalThis is not available", () => {
      (global as unknown as { globalThis: undefined }).globalThis = undefined;

      expect(networkMonitor.isConnected()).to.be.false;
    });
  });

  describe("connection events", () => {
    let connectHandler: () => void;
    let disconnectHandler: () => void;

    beforeEach(() => {
      networkMonitor = new NetworkMonitor({
        libp2p,
        events
      });
      networkMonitor.start();

      const addEventListenerStub = libp2p.addEventListener as sinon.SinonStub;

      connectHandler = addEventListenerStub.getCall(0).args[1];
      disconnectHandler = addEventListenerStub.getCall(1).args[1];
    });

    it("should handle peer connect event", () => {
      expect(networkMonitor.isConnected()).to.be.false;

      connectHandler();

      expect(networkMonitor.isConnected()).to.be.true;
      const dispatchEventStub = events.dispatchEvent as sinon.SinonStub;
      expect(dispatchEventStub.calledOnce).to.be.true;
    });

    it("should handle peer disconnect event when no connections remain", () => {
      connectHandler();

      const dispatchEventStub = events.dispatchEvent as sinon.SinonStub;
      dispatchEventStub.resetHistory();

      const getConnectionsStub = libp2p.getConnections as sinon.SinonStub;
      getConnectionsStub.returns([]);

      disconnectHandler();

      expect(networkMonitor.isConnected()).to.be.false;
      expect(dispatchEventStub.calledOnce).to.be.true;
    });

    it("should not change state when connections remain after disconnect", () => {
      connectHandler();

      const dispatchEventStub = events.dispatchEvent as sinon.SinonStub;
      dispatchEventStub.resetHistory();

      const getConnectionsStub = libp2p.getConnections as sinon.SinonStub;
      getConnectionsStub.returns([{ id: "connection1" }]);

      disconnectHandler();

      expect(networkMonitor.isConnected()).to.be.true;
      expect(dispatchEventStub.called).to.be.false;
    });

    it("should not dispatch event when already connected", () => {
      connectHandler();
      const dispatchEventStub = events.dispatchEvent as sinon.SinonStub;
      dispatchEventStub.resetHistory();

      connectHandler();

      expect(dispatchEventStub.called).to.be.false;
    });

    it("should not dispatch event when already disconnected", () => {
      connectHandler();

      const getConnectionsStub = libp2p.getConnections as sinon.SinonStub;
      getConnectionsStub.returns([]);
      disconnectHandler();

      const dispatchEventStub = events.dispatchEvent as sinon.SinonStub;
      dispatchEventStub.resetHistory();

      disconnectHandler();

      expect(dispatchEventStub.called).to.be.false;
    });
  });

  describe("browser online/offline events", () => {
    let onlineHandler: () => void;
    let offlineHandler: () => void;

    beforeEach(() => {
      networkMonitor = new NetworkMonitor({
        libp2p,
        events
      });
      networkMonitor.start();

      onlineHandler = mockGlobalThis.addEventListener.getCall(0).args[1];
      offlineHandler = mockGlobalThis.addEventListener.getCall(1).args[1];
    });

    it("should dispatch network event when browser goes online", () => {
      if (mockGlobalThis.navigator) {
        mockGlobalThis.navigator.onLine = true;
      }

      onlineHandler();

      const dispatchEventStub = events.dispatchEvent as sinon.SinonStub;
      expect(dispatchEventStub.calledOnce).to.be.true;
    });

    it("should dispatch network event when browser goes offline", () => {
      if (mockGlobalThis.navigator) {
        mockGlobalThis.navigator.onLine = false;
      }

      offlineHandler();

      const dispatchEventStub = events.dispatchEvent as sinon.SinonStub;
      expect(dispatchEventStub.calledOnce).to.be.true;
    });
  });

  describe("dispatchNetworkEvent", () => {
    beforeEach(() => {
      networkMonitor = new NetworkMonitor({
        libp2p,
        events
      });
    });

    it("should dispatch CustomEvent with correct type and detail", () => {
      networkMonitor.start();
      const addEventListenerStub = libp2p.addEventListener as sinon.SinonStub;
      const connectHandler = addEventListenerStub.getCall(0).args[1];
      connectHandler();

      const dispatchEventStub = events.dispatchEvent as sinon.SinonStub;
      expect(dispatchEventStub.calledOnce).to.be.true;
      const dispatchedEvent = dispatchEventStub.getCall(0)
        .args[0] as CustomEvent<boolean>;
      expect(dispatchedEvent).to.be.instanceOf(CustomEvent);
      expect(dispatchedEvent.type).to.equal(WakuEventType.Connection);
      expect(dispatchedEvent.detail).to.be.true;
    });
  });

  describe("error handling", () => {
    beforeEach(() => {
      networkMonitor = new NetworkMonitor({
        libp2p,
        events
      });
    });

    it("should handle errors when getting connections", () => {
      const getConnectionsStub = libp2p.getConnections as sinon.SinonStub;
      getConnectionsStub.throws(new Error("Get connections failed"));

      networkMonitor.start();

      const addEventListenerStub = libp2p.addEventListener as sinon.SinonStub;
      const connectHandler = addEventListenerStub.getCall(0).args[1];
      const disconnectHandler = addEventListenerStub.getCall(1).args[1];

      connectHandler();
      expect(networkMonitor.isConnected()).to.be.true;

      expect(() => disconnectHandler()).to.throw("Get connections failed");
    });

    it("should handle errors when accessing navigator", () => {
      Object.defineProperty(mockGlobalThis, "navigator", {
        get: () => {
          throw new Error("Navigator access failed");
        }
      });

      expect(networkMonitor.isConnected()).to.be.false;
    });
  });

  describe("connected peer events", () => {
    let identifyHandler: (event: CustomEvent) => void;

    beforeEach(() => {
      networkMonitor = new NetworkMonitor({
        libp2p,
        events
      });
      networkMonitor.start();

      const addEventListenerStub = libp2p.addEventListener as sinon.SinonStub;

      identifyHandler = addEventListenerStub.getCall(2).args[1];
    });

    it("should handle peer identify event", () => {
      const peerId = createMockPeerId("12D3KooWTest1");
      const mockIdentifyEvent = new CustomEvent("peer:identify", {
        detail: {
          peerId,
          protocols: [StoreCodec, "/not/waku/related/codec"]
        }
      });

      identifyHandler(mockIdentifyEvent);

      const dispatchEventStub = events.dispatchEvent as sinon.SinonStub;
      expect(dispatchEventStub.calledOnce).to.be.true;

      const dispatchedEvent = dispatchEventStub.getCall(0)
        .args[0] as CustomEvent<{ protocols: Protocols[]; peerId: PeerId }>;
      expect(dispatchedEvent.type).to.equal(WakuEventType.ConnectedPeer);
      expect(dispatchedEvent.detail.protocols).to.deep.equal([Protocols.Store]);
      expect(dispatchedEvent.detail.peerId.toString()).to.equal(
        "12D3KooWTest1"
      );
    });
  });

  describe("integration", () => {
    beforeEach(() => {
      networkMonitor = new NetworkMonitor({
        libp2p,
        events
      });
      networkMonitor.start();
    });

    it("should handle complete connection lifecycle", () => {
      const addEventListenerStub = libp2p.addEventListener as sinon.SinonStub;
      const connectHandler = addEventListenerStub.getCall(0).args[1];
      const disconnectHandler = addEventListenerStub.getCall(1).args[1];
      const getConnectionsStub = libp2p.getConnections as sinon.SinonStub;

      expect(networkMonitor.isConnected()).to.be.false;

      connectHandler();
      expect(networkMonitor.isConnected()).to.be.true;

      getConnectionsStub.returns([{ id: "other" }]);
      disconnectHandler();
      expect(networkMonitor.isConnected()).to.be.true;

      getConnectionsStub.returns([]);
      disconnectHandler();
      expect(networkMonitor.isConnected()).to.be.false;
    });

    it("should handle browser offline state overriding peer connections", () => {
      const addEventListenerStub = libp2p.addEventListener as sinon.SinonStub;
      const connectHandler = addEventListenerStub.getCall(0).args[1];

      connectHandler();
      expect(networkMonitor.isConnected()).to.be.true;

      if (mockGlobalThis.navigator) {
        mockGlobalThis.navigator.onLine = false;
      }
      expect(networkMonitor.isConnected()).to.be.false;

      if (mockGlobalThis.navigator) {
        mockGlobalThis.navigator.onLine = true;
      }
      expect(networkMonitor.isConnected()).to.be.true;
    });
  });
});

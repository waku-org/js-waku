import type { PeerId } from "@libp2p/interface";
import { expect } from "chai";
import sinon from "sinon";

import { KeepAliveManager } from "./keep_alive_manager.js";

describe("KeepAliveManager", () => {
  let libp2p: any;
  let relay: any;
  let keepAliveManager: KeepAliveManager;
  let mockPeerId: PeerId;
  let mockPeerId2: PeerId;
  let clock: sinon.SinonFakeTimers;

  const createMockPeerId = (id: string): PeerId =>
    ({
      toString: () => id,
      equals: (other: PeerId) => other.toString() === id
    }) as PeerId;

  const defaultOptions = {
    pingKeepAlive: 30,
    relayKeepAlive: 60
  };

  beforeEach(() => {
    clock = sinon.useFakeTimers();

    mockPeerId = createMockPeerId("12D3KooWTest1");
    mockPeerId2 = createMockPeerId("12D3KooWTest2");

    libp2p = {
      addEventListener: sinon.stub(),
      removeEventListener: sinon.stub(),
      services: {
        ping: {
          ping: sinon.stub().resolves(100)
        }
      },
      peerStore: {
        merge: sinon.stub().resolves()
      }
    };

    relay = {
      pubsubTopics: ["/waku/2/rs/1/0", "/waku/2/rs/1/1"],
      getMeshPeers: sinon.stub().returns(["12D3KooWTest1"]),
      send: sinon.stub().resolves()
    };
  });

  afterEach(() => {
    if (keepAliveManager) {
      keepAliveManager.stop();
    }
    clock.restore();
    sinon.restore();
  });

  describe("constructor", () => {
    it("should create KeepAliveManager with required options", () => {
      keepAliveManager = new KeepAliveManager({
        options: defaultOptions,
        libp2p
      });

      expect(keepAliveManager).to.be.instanceOf(KeepAliveManager);
    });

    it("should create KeepAliveManager with relay", () => {
      keepAliveManager = new KeepAliveManager({
        options: defaultOptions,
        libp2p,
        relay
      });

      expect(keepAliveManager).to.be.instanceOf(KeepAliveManager);
    });
  });

  describe("start", () => {
    beforeEach(() => {
      keepAliveManager = new KeepAliveManager({
        options: defaultOptions,
        libp2p
      });
    });

    it("should add event listeners for peer connect and disconnect", () => {
      keepAliveManager.start();

      expect(libp2p.addEventListener.calledTwice).to.be.true;
      expect(
        libp2p.addEventListener.calledWith("peer:connect", sinon.match.func)
      ).to.be.true;
      expect(
        libp2p.addEventListener.calledWith("peer:disconnect", sinon.match.func)
      ).to.be.true;
    });

    it("should be safe to call multiple times", () => {
      keepAliveManager.start();
      keepAliveManager.start();

      expect(libp2p.addEventListener.callCount).to.equal(4);
    });
  });

  describe("stop", () => {
    beforeEach(() => {
      keepAliveManager = new KeepAliveManager({
        options: defaultOptions,
        libp2p,
        relay
      });
      keepAliveManager.start();
    });

    it("should remove event listeners", () => {
      keepAliveManager.stop();

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

    it("should clear all timers", () => {
      const peerConnectHandler = libp2p.addEventListener.getCall(0).args[1];
      const connectEvent = new CustomEvent("peer:connect", {
        detail: mockPeerId
      });
      peerConnectHandler(connectEvent);

      const timersBeforeStop = clock.countTimers();
      expect(timersBeforeStop).to.be.greaterThan(0);

      keepAliveManager.stop();

      expect(clock.countTimers()).to.equal(0);
    });

    it("should be safe to call multiple times", () => {
      keepAliveManager.stop();
      keepAliveManager.stop();

      expect(libp2p.removeEventListener.callCount).to.equal(4);
    });
  });

  describe("peer connect event handling", () => {
    beforeEach(() => {
      keepAliveManager = new KeepAliveManager({
        options: defaultOptions,
        libp2p,
        relay
      });
      keepAliveManager.start();
    });

    it("should start ping timers on peer connect", () => {
      const peerConnectHandler = libp2p.addEventListener.getCall(0).args[1];
      const connectEvent = new CustomEvent("peer:connect", {
        detail: mockPeerId
      });
      peerConnectHandler(connectEvent);

      expect(clock.countTimers()).to.be.greaterThan(0);
    });

    it("should handle multiple peer connections", () => {
      const peerConnectHandler = libp2p.addEventListener.getCall(0).args[1];
      const connectEvent1 = new CustomEvent("peer:connect", {
        detail: mockPeerId
      });
      const connectEvent2 = new CustomEvent("peer:connect", {
        detail: mockPeerId2
      });

      peerConnectHandler(connectEvent1);
      peerConnectHandler(connectEvent2);

      expect(clock.countTimers()).to.be.greaterThan(1);
    });
  });

  describe("peer disconnect event handling", () => {
    beforeEach(() => {
      keepAliveManager = new KeepAliveManager({
        options: defaultOptions,
        libp2p,
        relay
      });
      keepAliveManager.start();
    });

    it("should stop ping timers on peer disconnect", () => {
      const peerConnectHandler = libp2p.addEventListener.getCall(0).args[1];
      const peerDisconnectHandler = libp2p.addEventListener.getCall(1).args[1];

      const connectEvent = new CustomEvent("peer:connect", {
        detail: mockPeerId
      });
      peerConnectHandler(connectEvent);

      const timerCountAfterConnect = clock.countTimers();
      expect(timerCountAfterConnect).to.be.greaterThan(0);

      const disconnectEvent = new CustomEvent("peer:disconnect", {
        detail: mockPeerId
      });
      peerDisconnectHandler(disconnectEvent);

      expect(clock.countTimers()).to.be.lessThan(timerCountAfterConnect);
    });
  });

  describe("ping timer management", () => {
    beforeEach(() => {
      keepAliveManager = new KeepAliveManager({
        options: defaultOptions,
        libp2p
      });
      keepAliveManager.start();
    });

    it("should create ping timers when pingKeepAlive > 0", () => {
      const peerConnectHandler = libp2p.addEventListener.getCall(0).args[1];
      const connectEvent = new CustomEvent("peer:connect", {
        detail: mockPeerId
      });
      peerConnectHandler(connectEvent);

      expect(clock.countTimers()).to.be.greaterThan(0);
    });

    it("should not create ping timers when pingKeepAlive = 0", () => {
      keepAliveManager.stop();
      keepAliveManager = new KeepAliveManager({
        options: { pingKeepAlive: 0, relayKeepAlive: 0 },
        libp2p
      });
      keepAliveManager.start();

      const peerConnectHandler = libp2p.addEventListener.getCall(2).args[1];
      const connectEvent = new CustomEvent("peer:connect", {
        detail: mockPeerId
      });
      peerConnectHandler(connectEvent);

      expect(clock.countTimers()).to.equal(0);
    });

    it("should perform ping and update peer store on timer", async () => {
      const peerConnectHandler = libp2p.addEventListener.getCall(0).args[1];
      const connectEvent = new CustomEvent("peer:connect", {
        detail: mockPeerId
      });
      peerConnectHandler(connectEvent);

      clock.tick(defaultOptions.pingKeepAlive * 1000);

      await clock.tickAsync(0);

      sinon.assert.calledWith(libp2p.services.ping.ping, mockPeerId);
      sinon.assert.calledWith(
        libp2p.peerStore.merge,
        mockPeerId,
        sinon.match.object
      );
    });

    it("should handle ping failures gracefully", async () => {
      libp2p.services.ping.ping.rejects(new Error("Ping failed"));

      const peerConnectHandler = libp2p.addEventListener.getCall(0).args[1];
      const connectEvent = new CustomEvent("peer:connect", {
        detail: mockPeerId
      });
      peerConnectHandler(connectEvent);

      clock.tick(defaultOptions.pingKeepAlive * 1000);
      await clock.tickAsync(0);

      sinon.assert.calledWith(libp2p.services.ping.ping, mockPeerId);
      sinon.assert.notCalled(libp2p.peerStore.merge);
    });

    it("should handle peer store update failures gracefully", async () => {
      libp2p.peerStore.merge.rejects(new Error("Peer store update failed"));

      const peerConnectHandler = libp2p.addEventListener.getCall(0).args[1];
      const connectEvent = new CustomEvent("peer:connect", {
        detail: mockPeerId
      });
      peerConnectHandler(connectEvent);

      clock.tick(defaultOptions.pingKeepAlive * 1000);
      await clock.tickAsync(0);

      sinon.assert.calledWith(libp2p.services.ping.ping, mockPeerId);
      sinon.assert.calledWith(
        libp2p.peerStore.merge,
        mockPeerId,
        sinon.match.object
      );
    });
  });

  describe("relay timer management", () => {
    beforeEach(() => {
      keepAliveManager = new KeepAliveManager({
        options: defaultOptions,
        libp2p,
        relay
      });
      keepAliveManager.start();
    });

    it("should create relay timers when relay exists and relayKeepAlive > 0", () => {
      const peerConnectHandler = libp2p.addEventListener.getCall(0).args[1];
      const connectEvent = new CustomEvent("peer:connect", {
        detail: mockPeerId
      });
      peerConnectHandler(connectEvent);

      expect(clock.countTimers()).to.be.greaterThan(1);
    });

    it("should not create relay timers when relayKeepAlive = 0", () => {
      keepAliveManager.stop();
      keepAliveManager = new KeepAliveManager({
        options: { pingKeepAlive: 30, relayKeepAlive: 0 },
        libp2p,
        relay
      });
      keepAliveManager.start();

      const peerConnectHandler = libp2p.addEventListener.getCall(2).args[1];
      const connectEvent = new CustomEvent("peer:connect", {
        detail: mockPeerId
      });
      peerConnectHandler(connectEvent);

      expect(clock.countTimers()).to.equal(1);
    });

    it("should not create relay timers when relay is not provided", () => {
      keepAliveManager.stop();
      keepAliveManager = new KeepAliveManager({
        options: defaultOptions,
        libp2p
      });
      keepAliveManager.start();

      const peerConnectHandler = libp2p.addEventListener.getCall(2).args[1];
      const connectEvent = new CustomEvent("peer:connect", {
        detail: mockPeerId
      });
      peerConnectHandler(connectEvent);

      expect(clock.countTimers()).to.equal(1);
    });

    it("should create timers for each pubsub topic where peer is in mesh", () => {
      const peerConnectHandler = libp2p.addEventListener.getCall(0).args[1];
      const connectEvent = new CustomEvent("peer:connect", {
        detail: mockPeerId
      });
      peerConnectHandler(connectEvent);

      expect(clock.countTimers()).to.be.greaterThan(relay.pubsubTopics.length);
    });

    it("should not create timers for topics where peer is not in mesh", () => {
      relay.getMeshPeers.returns([]);

      const peerConnectHandler = libp2p.addEventListener.getCall(0).args[1];
      const connectEvent = new CustomEvent("peer:connect", {
        detail: mockPeerId
      });
      peerConnectHandler(connectEvent);

      expect(clock.countTimers()).to.equal(1);
    });

    it("should send relay ping messages on timer", async () => {
      const peerConnectHandler = libp2p.addEventListener.getCall(0).args[1];
      const connectEvent = new CustomEvent("peer:connect", {
        detail: mockPeerId
      });
      peerConnectHandler(connectEvent);

      clock.tick(defaultOptions.relayKeepAlive * 1000);
      await clock.tickAsync(0);

      sinon.assert.called(relay.send);
    });

    it("should handle relay send failures gracefully", async () => {
      relay.send.rejects(new Error("Relay send failed"));

      const peerConnectHandler = libp2p.addEventListener.getCall(0).args[1];
      const connectEvent = new CustomEvent("peer:connect", {
        detail: mockPeerId
      });
      peerConnectHandler(connectEvent);

      clock.tick(defaultOptions.relayKeepAlive * 1000);
      await clock.tickAsync(0);

      sinon.assert.called(relay.send);
    });
  });

  describe("timer cleanup", () => {
    beforeEach(() => {
      keepAliveManager = new KeepAliveManager({
        options: defaultOptions,
        libp2p,
        relay
      });
      keepAliveManager.start();
    });

    it("should clear timers for specific peer on disconnect", () => {
      const peerConnectHandler = libp2p.addEventListener.getCall(0).args[1];
      const peerDisconnectHandler = libp2p.addEventListener.getCall(1).args[1];

      const connectEvent1 = new CustomEvent("peer:connect", {
        detail: mockPeerId
      });
      const connectEvent2 = new CustomEvent("peer:connect", {
        detail: mockPeerId2
      });
      peerConnectHandler(connectEvent1);
      peerConnectHandler(connectEvent2);

      const timerCountAfterConnect = clock.countTimers();
      expect(timerCountAfterConnect).to.be.greaterThan(0);

      const disconnectEvent = new CustomEvent("peer:disconnect", {
        detail: mockPeerId
      });
      peerDisconnectHandler(disconnectEvent);

      expect(clock.countTimers()).to.be.lessThan(timerCountAfterConnect);
      expect(clock.countTimers()).to.be.greaterThan(0);
    });

    it("should handle disconnect when peer has no timers", () => {
      const peerDisconnectHandler = libp2p.addEventListener.getCall(1).args[1];
      const disconnectEvent = new CustomEvent("peer:disconnect", {
        detail: mockPeerId
      });

      expect(() => peerDisconnectHandler(disconnectEvent)).to.not.throw();
    });

    it("should clear existing timers before creating new ones", () => {
      const peerConnectHandler = libp2p.addEventListener.getCall(0).args[1];
      const connectEvent = new CustomEvent("peer:connect", {
        detail: mockPeerId
      });

      peerConnectHandler(connectEvent);
      const timerCountAfterFirst = clock.countTimers();

      peerConnectHandler(connectEvent);
      const timerCountAfterSecond = clock.countTimers();

      expect(timerCountAfterSecond).to.equal(timerCountAfterFirst);
    });
  });

  describe("edge cases", () => {
    it("should handle empty pubsub topics", () => {
      const emptyRelay = {
        pubsubTopics: [],
        getMeshPeers: sinon.stub().returns([]),
        send: sinon.stub().resolves()
      } as any;

      keepAliveManager = new KeepAliveManager({
        options: defaultOptions,
        libp2p,
        relay: emptyRelay
      });
      keepAliveManager.start();

      const peerConnectHandler = libp2p.addEventListener.getCall(0).args[1];
      const connectEvent = new CustomEvent("peer:connect", {
        detail: mockPeerId
      });
      peerConnectHandler(connectEvent);

      expect(clock.countTimers()).to.equal(1);
    });

    it("should handle all zero keep alive options", () => {
      keepAliveManager = new KeepAliveManager({
        options: { pingKeepAlive: 0, relayKeepAlive: 0 },
        libp2p,
        relay
      });
      keepAliveManager.start();

      const peerConnectHandler = libp2p.addEventListener.getCall(0).args[1];
      const connectEvent = new CustomEvent("peer:connect", {
        detail: mockPeerId
      });
      peerConnectHandler(connectEvent);

      expect(clock.countTimers()).to.equal(0);
    });

    it("should handle peer not in mesh for all topics", () => {
      relay.getMeshPeers.returns(["different-peer-id"]);

      keepAliveManager = new KeepAliveManager({
        options: defaultOptions,
        libp2p,
        relay
      });
      keepAliveManager.start();

      const peerConnectHandler = libp2p.addEventListener.getCall(0).args[1];
      const connectEvent = new CustomEvent("peer:connect", {
        detail: mockPeerId
      });
      peerConnectHandler(connectEvent);

      expect(clock.countTimers()).to.equal(1);
    });
  });

  describe("integration", () => {
    it("should handle complete peer lifecycle", async () => {
      keepAliveManager = new KeepAliveManager({
        options: defaultOptions,
        libp2p,
        relay
      });
      keepAliveManager.start();

      const peerConnectHandler = libp2p.addEventListener.getCall(0).args[1];
      const peerDisconnectHandler = libp2p.addEventListener.getCall(1).args[1];

      const connectEvent = new CustomEvent("peer:connect", {
        detail: mockPeerId
      });
      peerConnectHandler(connectEvent);

      expect(clock.countTimers()).to.be.greaterThan(0);

      clock.tick(
        Math.max(defaultOptions.pingKeepAlive, defaultOptions.relayKeepAlive) *
          1000
      );
      await clock.tickAsync(0);

      sinon.assert.called(libp2p.services.ping.ping);
      sinon.assert.called(relay.send);

      const disconnectEvent = new CustomEvent("peer:disconnect", {
        detail: mockPeerId
      });
      peerDisconnectHandler(disconnectEvent);

      expect(clock.countTimers()).to.equal(0);

      keepAliveManager.stop();

      sinon.assert.called(libp2p.removeEventListener);
    });
  });
});

import { Connection, Peer } from "@libp2p/interface";
import { FilterCodecs, LightPushCodec } from "@waku/core";
import {
  HealthStatus,
  IWakuEventEmitter,
  Libp2p,
  WakuEventType
} from "@waku/interfaces";
import { expect } from "chai";
import sinon from "sinon";

import { HealthIndicator } from "./health_indicator.js";

describe("HealthIndicator", () => {
  let libp2p: Libp2p;
  let events: IWakuEventEmitter;
  let healthIndicator: HealthIndicator;

  beforeEach(() => {
    libp2p = mockLibp2p();
    events = mockEvents();
    healthIndicator = new HealthIndicator({ libp2p, events });
  });

  afterEach(() => {
    healthIndicator.stop();
    sinon.restore();
  });

  it("should initialize with Unhealthy status", () => {
    expect(healthIndicator.toValue()).to.equal(HealthStatus.Unhealthy);
  });

  it("should transition to Unhealthy when no connections", async () => {
    healthIndicator.start();

    // Only track transition, starting as healthy
    (healthIndicator as any).value = HealthStatus.SufficientlyHealthy;

    // Start monitoring
    const statusChangePromise = new Promise<HealthStatus>((resolve) => {
      events.addEventListener(
        WakuEventType.Health,
        (e: CustomEvent<HealthStatus>) => resolve(e.detail)
      );
    });

    const connections: Connection[] = [];
    sinon.stub(libp2p, "getConnections").returns(connections);

    libp2p.dispatchEvent(new CustomEvent("peer:disconnect", { detail: "1" }));

    const changedStatus = await statusChangePromise;
    expect(changedStatus).to.equal(HealthStatus.Unhealthy);
    expect(healthIndicator.toValue()).to.equal(HealthStatus.Unhealthy);
  });

  it("should transition to MinimallyHealthy with one compatible peer", async () => {
    healthIndicator.start();

    const statusChangePromise = new Promise<HealthStatus>((resolve) => {
      events.addEventListener(
        WakuEventType.Health,
        (e: CustomEvent<HealthStatus>) => resolve(e.detail)
      );
    });

    const peer = mockPeer("1", [FilterCodecs.SUBSCRIBE, LightPushCodec]);
    const connections = [mockConnection("1")];
    sinon.stub(libp2p, "getConnections").returns(connections);
    sinon.stub(libp2p.peerStore, "get").resolves(peer);

    libp2p.dispatchEvent(
      new CustomEvent("peer:identify", { detail: { peerId: "1" } })
    );

    const changedStatus = await statusChangePromise;
    expect(changedStatus).to.equal(HealthStatus.MinimallyHealthy);
    expect(healthIndicator.toValue()).to.equal(HealthStatus.MinimallyHealthy);
  });

  it("should transition to SufficientlyHealthy with multiple compatible peers", async () => {
    healthIndicator.start();

    const statusChangePromise = new Promise<HealthStatus>((resolve) => {
      events.addEventListener(
        WakuEventType.Health,
        (e: CustomEvent<HealthStatus>) => resolve(e.detail)
      );
    });

    const peer1 = mockPeer("1", [FilterCodecs.SUBSCRIBE, LightPushCodec]);
    const peer2 = mockPeer("2", [FilterCodecs.SUBSCRIBE, LightPushCodec]);
    const connections = [mockConnection("1"), mockConnection("2")];

    sinon.stub(libp2p, "getConnections").returns(connections);
    const peerStoreStub = sinon.stub(libp2p.peerStore, "get");
    peerStoreStub.withArgs(connections[0].remotePeer).resolves(peer1);
    peerStoreStub.withArgs(connections[1].remotePeer).resolves(peer2);

    libp2p.dispatchEvent(
      new CustomEvent("peer:identify", { detail: { peerId: "2" } })
    );

    const changedStatus = await statusChangePromise;
    expect(changedStatus).to.equal(HealthStatus.SufficientlyHealthy);
    expect(healthIndicator.toValue()).to.equal(
      HealthStatus.SufficientlyHealthy
    );
  });

  it("should properly start and stop event listening", () => {
    const addEventSpy = sinon.spy(libp2p, "addEventListener");
    const removeEventSpy = sinon.spy(libp2p, "removeEventListener");

    healthIndicator.start();
    expect(addEventSpy.calledTwice).to.be.true;
    expect(addEventSpy.firstCall.args[0]).to.equal("peer:identify");
    expect(addEventSpy.secondCall.args[0]).to.equal("peer:disconnect");

    healthIndicator.stop();
    expect(removeEventSpy.calledTwice).to.be.true;
    expect(removeEventSpy.firstCall.args[0]).to.equal("peer:identify");
    expect(removeEventSpy.secondCall.args[0]).to.equal("peer:disconnect");
  });

  it("should reassess health immediately when peer disconnects", async () => {
    const peer1 = mockPeer("1", [FilterCodecs.SUBSCRIBE, LightPushCodec]);
    const peer2 = mockPeer("2", [FilterCodecs.SUBSCRIBE, LightPushCodec]);
    const connection1 = mockConnection("1");
    const connection2 = mockConnection("2");
    const connections = [connection1, connection2];

    const getConnectionsStub = sinon
      .stub(libp2p, "getConnections")
      .returns(connections);
    const peerStoreStub = sinon.stub(libp2p.peerStore, "get");
    peerStoreStub.withArgs(connection1.remotePeer).resolves(peer1);
    peerStoreStub.withArgs(connection2.remotePeer).resolves(peer2);

    const statusChangePromise = new Promise<HealthStatus>((resolve) => {
      events.addEventListener("waku:health", (e: CustomEvent<HealthStatus>) =>
        resolve(e.detail)
      );
    });

    healthIndicator.start();

    await statusChangePromise;
    expect(healthIndicator.toValue()).to.equal(
      HealthStatus.SufficientlyHealthy
    );

    const statusChangePromise2 = new Promise<HealthStatus>((resolve) => {
      events.addEventListener("waku:health", (e: CustomEvent<HealthStatus>) =>
        resolve(e.detail)
      );
    });

    const remainingConnections = [connection1];
    getConnectionsStub.returns(remainingConnections);

    libp2p.dispatchEvent(new CustomEvent("peer:disconnect", { detail: "2" }));

    const changedStatus = await statusChangePromise2;
    expect(changedStatus).to.equal(HealthStatus.MinimallyHealthy);
    expect(healthIndicator.toValue()).to.equal(HealthStatus.MinimallyHealthy);
  });

  it("should perform initial health assessment on start", async () => {
    const peer = mockPeer("1", [FilterCodecs.SUBSCRIBE, LightPushCodec]);
    const connections = [mockConnection("1")];
    sinon.stub(libp2p, "getConnections").returns(connections);
    sinon.stub(libp2p.peerStore, "get").resolves(peer);

    const statusChangePromise = new Promise<HealthStatus>((resolve) => {
      events.addEventListener("waku:health", (e: CustomEvent<HealthStatus>) =>
        resolve(e.detail)
      );
    });

    healthIndicator.start();

    const changedStatus = await statusChangePromise;
    expect(changedStatus).to.equal(HealthStatus.MinimallyHealthy);
    expect(healthIndicator.toValue()).to.equal(HealthStatus.MinimallyHealthy);
  });

  it("should handle peer store errors gracefully", async function () {
    this.timeout(5000);

    // Start with a healthy state
    (healthIndicator as any).value = HealthStatus.SufficientlyHealthy;

    const connections = [mockConnection("1")];
    sinon.stub(libp2p, "getConnections").returns(connections);
    sinon.stub(libp2p.peerStore, "get").rejects(new Error("Peer not found"));

    const statusChangePromise = new Promise<HealthStatus>((resolve) => {
      events.addEventListener("waku:health", (e: CustomEvent<HealthStatus>) =>
        resolve(e.detail)
      );
    });

    healthIndicator.start();

    const changedStatus = await statusChangePromise;
    expect(changedStatus).to.equal(HealthStatus.Unhealthy);
    expect(healthIndicator.toValue()).to.equal(HealthStatus.Unhealthy);
  });

  it("should handle mixed protocol support correctly", async () => {
    // Start with a healthy state to ensure status change
    (healthIndicator as any).value = HealthStatus.SufficientlyHealthy;

    const peer1 = mockPeer("1", [FilterCodecs.SUBSCRIBE]);
    const peer2 = mockPeer("2", [LightPushCodec]);
    const connection1 = mockConnection("1");
    const connection2 = mockConnection("2");
    const connections = [connection1, connection2];

    sinon.stub(libp2p, "getConnections").returns(connections);
    const peerStoreStub = sinon.stub(libp2p.peerStore, "get");
    peerStoreStub.withArgs(connection1.remotePeer).resolves(peer1);
    peerStoreStub.withArgs(connection2.remotePeer).resolves(peer2);

    const statusChangePromise = new Promise<HealthStatus>((resolve) => {
      events.addEventListener("waku:health", (e: CustomEvent<HealthStatus>) =>
        resolve(e.detail)
      );
    });

    healthIndicator.start();

    const changedStatus = await statusChangePromise;
    expect(changedStatus).to.equal(HealthStatus.MinimallyHealthy);
    expect(healthIndicator.toValue()).to.equal(HealthStatus.MinimallyHealthy);
  });
});

function mockLibp2p(): Libp2p {
  const peerStore = {
    get: () => Promise.reject(new Error("Peer not found"))
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

function mockEvents(): IWakuEventEmitter {
  const events = new EventTarget();

  return {
    addEventListener: (event: string, handler: EventListener) =>
      events.addEventListener(event, handler),
    removeEventListener: (event: string, handler: EventListener) =>
      events.removeEventListener(event, handler),
    dispatchEvent: (event: Event) => events.dispatchEvent(event)
  } as unknown as IWakuEventEmitter;
}

function mockPeer(id: string, protocols: string[]): Peer {
  return {
    id,
    protocols
  } as unknown as Peer;
}

function mockConnection(id: string): Connection {
  return {
    remotePeer: {
      toString: () => id,
      equals: (other: any) => other.toString() === id
    },
    status: "open"
  } as unknown as Connection;
}

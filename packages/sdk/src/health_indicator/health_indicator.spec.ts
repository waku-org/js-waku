import { Connection, Peer } from "@libp2p/interface";
import { FilterCodecs, LightPushCodec } from "@waku/core";
import {
  HealthStatus,
  HealthStatusChangeEvents,
  Libp2p
} from "@waku/interfaces";
import { expect } from "chai";
import sinon from "sinon";

import { HealthIndicator } from "./health_indicator.js";

describe("HealthIndicator", () => {
  let libp2p: Libp2p;
  let healthIndicator: HealthIndicator;

  beforeEach(() => {
    libp2p = mockLibp2p();
    healthIndicator = new HealthIndicator({ libp2p });
    healthIndicator.start();
  });

  afterEach(() => {
    healthIndicator.stop();
    sinon.restore();
  });

  it("should initialize with Unhealthy status", () => {
    expect(healthIndicator.toString()).to.equal(HealthStatus.Unhealthy);
  });

  it("should transition to Unhealthy when no connections", async () => {
    const statusChangePromise = new Promise<HealthStatus>((resolve) => {
      healthIndicator.addEventListener(
        HealthStatusChangeEvents.StatusChange,
        (e: CustomEvent<HealthStatus>) => resolve(e.detail)
      );
    });

    const connections: Connection[] = [];
    sinon.stub(libp2p, "getConnections").returns(connections);

    libp2p.dispatchEvent(new CustomEvent("peer:disconnect", { detail: "1" }));

    const changedStatus = await statusChangePromise;
    expect(changedStatus).to.equal(HealthStatus.Unhealthy);
    expect(healthIndicator.toString()).to.equal(HealthStatus.Unhealthy);
  });

  it("should transition to MinimallyHealthy with one compatible peer", async () => {
    const statusChangePromise = new Promise<HealthStatus>((resolve) => {
      healthIndicator.addEventListener(
        HealthStatusChangeEvents.StatusChange,
        (e: CustomEvent<HealthStatus>) => resolve(e.detail)
      );
    });

    const peer = mockPeer("1", [FilterCodecs.SUBSCRIBE, LightPushCodec]);
    const connections = [mockConnection("1")];
    sinon.stub(libp2p, "getConnections").returns(connections);
    sinon.stub(libp2p.peerStore, "get").resolves(peer);

    libp2p.dispatchEvent(new CustomEvent("peer:connect", { detail: "1" }));

    const changedStatus = await statusChangePromise;
    expect(changedStatus).to.equal(HealthStatus.MinimallyHealthy);
    expect(healthIndicator.toString()).to.equal(HealthStatus.MinimallyHealthy);
  });

  it("should transition to SufficientlyHealthy with multiple compatible peers", async () => {
    const statusChangePromise = new Promise<HealthStatus>((resolve) => {
      healthIndicator.addEventListener(
        HealthStatusChangeEvents.StatusChange,
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

    libp2p.dispatchEvent(new CustomEvent("peer:connect", { detail: "2" }));

    const changedStatus = await statusChangePromise;
    expect(changedStatus).to.equal(HealthStatus.SufficientlyHealthy);
    expect(healthIndicator.toString()).to.equal(
      HealthStatus.SufficientlyHealthy
    );
  });

  it("should properly start and stop event listening", () => {
    const addEventSpy = sinon.spy(libp2p, "addEventListener");
    const removeEventSpy = sinon.spy(libp2p, "removeEventListener");

    healthIndicator.start();
    expect(addEventSpy.calledTwice).to.be.true;

    healthIndicator.stop();
    expect(removeEventSpy.calledTwice).to.be.true;
  });
});

function mockLibp2p(): Libp2p {
  const peerStore = {
    get: (id: any) => Promise.resolve(mockPeer(id.toString(), []))
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

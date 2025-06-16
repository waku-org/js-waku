import { TypedEventEmitter } from "@libp2p/interface";
import type { DnsDiscoveryComponents } from "@waku/interfaces";
import { expect } from "chai";
import { describe, it } from "mocha";

import { createImmediatePeerDnsClient } from "./effect/test-helpers/mock-dns-client.js";
import { PeerDiscoveryDnsEffect as DnsNodeDiscovery } from "./effect/wrappers/dns-discovery-wrapper.js";

// Create mock components for testing
const createMockComponents = (): DnsDiscoveryComponents => {
  const eventTarget = new TypedEventEmitter();
  return {
    peerStore: {
      get: async () => ({ tags: new Map() }),
      save: async () => {},
      patch: async () => {},
      merge: async () => {},
      forEach: async () => {},
      all: async () => [],
      delete: async () => {},
      has: async () => false,
      consumePeerRecord: async () => false
    },
    connectionManager: {
      openConnection: async () => null as any,
      closeConnections: async () => {},
      getConnections: () => [],
      getConnectionsMap: () => new Map(),
      getDialQueue: () => []
    },
    events: eventTarget
  } as unknown as DnsDiscoveryComponents;
};

describe("DNS Discovery Wrapper", () => {
  describe("initialization", () => {
    it("should initialize with Effect services", async () => {
      const components = createMockComponents();
      const discovery = new DnsNodeDiscovery(components, {
        enrUrls: [
          "enrtree://AKA3AM6LPBYEUDMVNU3BSVQJ5AD45Y7YPOHJLEF6W26QOE4VTUDPE@nodes.example.org"
        ],
        wantedNodeCapabilityCount: {}
      });

      // The discovery object should be created
      expect(discovery).to.exist;
      expect(discovery).to.have.property("addEventListener");
      expect(discovery).to.have.property("removeEventListener");
      expect(discovery).to.have.property("start");
      expect(discovery).to.have.property("stop");
    });

    it("should start and stop without errors", async () => {
      const components = createMockComponents();
      const discovery = new DnsNodeDiscovery(components, {
        enrUrls: [
          "enrtree://AKA3AM6LPBYEUDMVNU3BSVQJ5AD45Y7YPOHJLEF6W26QOE4VTUDPE@nodes.example.org"
        ],
        wantedNodeCapabilityCount: {}
      });

      // Should start without errors
      await expect(discovery.start()).to.be.fulfilled;

      // Should stop without errors
      await expect(discovery.stop()).to.be.fulfilled;
    });
  });

  describe("with mock DNS client", () => {
    it("should discover peers from DNS records", async function () {
      this.timeout(10000);

      const components = createMockComponents();
      const discovery = new DnsNodeDiscovery(components, {
        enrUrls: [
          "enrtree://AKA3AM6LPBYEUDMVNU3BSVQJ5AD45Y7YPOHJLEF6W26QOE4VTUDPE@nodes.example.org"
        ],
        wantedNodeCapabilityCount: {},
        dnsClientLayer: createImmediatePeerDnsClient()
      });

      const discoveredPeers: Array<{ id: any; multiaddrs: Array<any> }> = [];

      discovery.addEventListener("peer", (event: any) => {
        discoveredPeers.push({
          id: event.detail.id,
          multiaddrs: event.detail.multiaddrs
        });
      });

      await discovery.start();

      // Wait for discovery to happen
      await new Promise((resolve) => setTimeout(resolve, 1000));

      await discovery.stop();

      // Should have discovered at least one peer
      expect(discoveredPeers).to.have.length.greaterThan(0);

      // Each discovered peer should have an ID and multiaddrs
      for (const peer of discoveredPeers) {
        expect(peer.id).to.exist;
        expect(peer.multiaddrs).to.be.an("array");
        expect(peer.multiaddrs).to.have.length.greaterThan(0);
      }
    });

    it("should filter peers by capabilities", async function () {
      this.timeout(10000);

      const components = createMockComponents();
      const discovery = new DnsNodeDiscovery(components, {
        enrUrls: [
          "enrtree://AKA3AM6LPBYEUDMVNU3BSVQJ5AD45Y7YPOHJLEF6W26QOE4VTUDPE@nodes.example.org"
        ],
        wantedNodeCapabilityCount: { relay: 1 },
        dnsClientLayer: createImmediatePeerDnsClient()
      });

      const discoveredPeers: Array<{ id: any; multiaddrs: Array<any> }> = [];

      discovery.addEventListener("peer", (event: any) => {
        discoveredPeers.push({
          id: event.detail.id,
          multiaddrs: event.detail.multiaddrs
        });
      });

      await discovery.start();

      // Wait for discovery to happen
      await new Promise((resolve) => setTimeout(resolve, 1000));

      await discovery.stop();

      // Should have discovered peers with relay capability
      expect(discoveredPeers).to.have.length.greaterThan(0);
    });
  });
});

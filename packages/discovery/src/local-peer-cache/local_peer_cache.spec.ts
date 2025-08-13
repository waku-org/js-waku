import { generateKeyPair } from "@libp2p/crypto/keys";
import type { IdentifyResult } from "@libp2p/interface";
import { TypedEventEmitter } from "@libp2p/interface";
import tests from "@libp2p/interface-compliance-tests/peer-discovery";
import { prefixLogger } from "@libp2p/logger";
import { peerIdFromPrivateKey, peerIdFromString } from "@libp2p/peer-id";
import { persistentPeerStore } from "@libp2p/peer-store";
import { multiaddr } from "@multiformats/multiaddr";
import { Libp2pComponents, PartialPeerInfo, PeerCache } from "@waku/interfaces";
import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { MemoryDatastore } from "datastore-core/memory";
import sinon from "sinon";

import { LocalPeerCacheDiscovery } from "./index.js";

chai.use(chaiAsPromised);

const mockPeers: PartialPeerInfo[] = [
  {
    id: "16Uiu2HAm4v86W3bmT1BiH6oSPzcsSr24iDQpSN5Qa992BCjjwgrD",
    multiaddrs: [
      "/ip4/127.0.0.1/tcp/8000/wss/p2p/16Uiu2HAm4v86W3bmT1BiH6oSPzcsSr24iDQpSN5Qa992BCjjwgrD"
    ]
  },
  {
    id: "16Uiu2HAm4v86W3bmT1BiH6oSPzcsSr24iDQpSN5Qa992BCjjwgrE",
    multiaddrs: [
      "/ip4/127.0.0.1/tcp/8001/wss/p2p/16Uiu2HAm4v86W3bmT1BiH6oSPzcsSr24iDQpSN5Qa992BCjjwgrE"
    ]
  }
];

class MockPeerCache implements PeerCache {
  public data: PartialPeerInfo[] = [];
  public throwOnGet = false;
  public get(): PartialPeerInfo[] {
    if (this.throwOnGet) {
      throw new Error("cache get error");
    }
    return this.data;
  }
  public set(value: PartialPeerInfo[]): void {
    this.data = value;
  }
  public remove(): void {
    this.data = [];
  }
}

async function setPeersInCache(
  cache: MockPeerCache,
  peers: PartialPeerInfo[]
): Promise<void> {
  cache.set(peers);
}

describe("Local Storage Discovery", function () {
  this.timeout(25_000);
  let components: Libp2pComponents;
  let mockCache: MockPeerCache;

  beforeEach(async function () {
    mockCache = new MockPeerCache();
    components = {
      peerStore: persistentPeerStore({
        events: new TypedEventEmitter(),
        peerId: await generateKeyPair("secp256k1").then(peerIdFromPrivateKey),
        datastore: new MemoryDatastore(),
        logger: prefixLogger("local_discovery.spec.ts")
      }),
      events: new TypedEventEmitter()
    } as unknown as Libp2pComponents;
  });

  describe("Compliance Tests", function () {
    beforeEach(async function () {
      mockCache = new MockPeerCache();
      await setPeersInCache(mockCache, [mockPeers[0]]);
    });

    tests({
      async setup() {
        return new LocalPeerCacheDiscovery(components, { cache: mockCache });
      },
      async teardown() {}
    });
  });

  describe("Unit Tests", function () {
    let discovery: LocalPeerCacheDiscovery;

    beforeEach(async function () {
      discovery = new LocalPeerCacheDiscovery(components, { cache: mockCache });
      await setPeersInCache(mockCache, mockPeers);
    });

    it("should load peers from local storage and dispatch events", async () => {
      const dispatchEventSpy = sinon.spy(discovery, "dispatchEvent");

      await discovery.start();

      expect(dispatchEventSpy.calledWith(sinon.match.has("type", "peer"))).to.be
        .true;

      const dispatchedIds = dispatchEventSpy
        .getCalls()
        .map((c) => (c.args[0] as CustomEvent<any>).detail?.id?.toString?.())
        .filter(Boolean);

      mockPeers.forEach((mockPeer) => {
        expect(dispatchedIds).to.include(mockPeer.id);
      });
    });

    it("should update peers in cache on 'peer:identify' event", async () => {
      await discovery.start();

      const newPeerIdentifyEvent = new CustomEvent<IdentifyResult>(
        "peer:identify",
        {
          detail: {
            peerId: peerIdFromString(mockPeers[1].id.toString()),
            listenAddrs: [multiaddr(mockPeers[1].multiaddrs[0])]
          } as IdentifyResult
        }
      );

      components.events.dispatchEvent(newPeerIdentifyEvent);

      expect(mockCache.get()).to.deep.include({
        id: mockPeers[1].id,
        multiaddrs: [mockPeers[1].multiaddrs[0]]
      });
    });

    it("should handle cache.get errors gracefully", async () => {
      mockCache.throwOnGet = true;

      try {
        await discovery.start();
      } catch (error) {
        expect.fail(
          "start() should not have thrown an error when cache.get throws"
        );
      }
    });

    it("should add and remove event listeners correctly", async () => {
      const addEventListenerSpy = sinon.spy(
        components.events,
        "addEventListener"
      );
      const removeEventListenerSpy = sinon.spy(
        components.events,
        "removeEventListener"
      );

      await discovery.start();
      expect(addEventListenerSpy.calledWith("peer:identify")).to.be.true;

      await discovery.stop();
      expect(removeEventListenerSpy.calledWith("peer:identify")).to.be.true;
    });
  });
});

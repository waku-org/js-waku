import { generateKeyPair } from "@libp2p/crypto/keys";
import { TypedEventEmitter } from "@libp2p/interface";
import tests from "@libp2p/interface-compliance-tests/peer-discovery";
import { prefixLogger } from "@libp2p/logger";
import { peerIdFromPrivateKey } from "@libp2p/peer-id";
import { persistentPeerStore } from "@libp2p/peer-store";
import {
  createImmediatePeerDnsClient,
  DnsNodeDiscovery,
  enrTree,
  PeerDiscoveryDns,
  wakuDnsDiscovery
} from "@waku/discovery";
import { Libp2pComponents } from "@waku/interfaces";
import { createLightNode } from "@waku/sdk";
import { expect } from "chai";
import { MemoryDatastore } from "datastore-core/memory";

import { delay } from "../src/index.js";

const maxQuantity = 3;

describe("DNS Discovery: Compliance Test", function () {
  this.timeout(10000);
  tests({
    async setup() {
      const privateKey = await generateKeyPair("secp256k1");
      const peerId = peerIdFromPrivateKey(privateKey);
      // create libp2p mock peerStore
      const components = {
        peerStore: persistentPeerStore({
          events: new TypedEventEmitter(),
          peerId,
          datastore: new MemoryDatastore(),
          logger: prefixLogger("dns-peer-discovery.spec.ts")
        })
      } as unknown as Libp2pComponents;

      // Use mock DNS client for compliance tests
      const mockDnsClientLayer = createImmediatePeerDnsClient();

      return new PeerDiscoveryDns(components, {
        enrUrls: [
          "enrtree://AKA3AM6LPBYEUDMVNU3BSVQJ5AD45Y7YPOHJLEF6W26QOE4VTUDPE@nodes.example.org"
        ],
        wantedNodeCapabilityCount: {
          relay: 1
        },
        dnsClientLayer: mockDnsClientLayer
      } as any);
    },
    async teardown() {
      //
    }
  });
});

describe("DNS Node Discovery [live data]", function () {
  before(function () {
    if (process.env.CI) {
      this.skip();
    }
  });

  it(`should debug DNS responses`, async function () {
    this.timeout(100000);

    console.log("=== Testing what we imported ===");
    console.log("wakuDnsDiscovery type:", typeof wakuDnsDiscovery);
    console.log("DnsNodeDiscovery type:", typeof DnsNodeDiscovery);
    console.log("enrTree TEST:", enrTree["TEST"]);

    console.log("=== Testing original DnsNodeDiscovery ===");
    const originalDns = await DnsNodeDiscovery.dnsOverHttp();
    const originalPeers = await originalDns.getPeers([enrTree["TEST"]], {
      relay: 3,
      store: 3,
      filter: 3,
      lightPush: 3
    });
    console.log(`[Original] Found ${originalPeers.length} peers total`);

    console.log("\n=== Testing Effect DNS through SDK ===");
    console.log("About to call wakuDnsDiscovery factory...");
    const discoveryFactory = wakuDnsDiscovery([enrTree["TEST"]], {
      relay: 3,
      store: 3,
      filter: 3,
      lightPush: 3
    });
    console.log("Factory created, about to create light node...");

    const waku = await createLightNode({
      libp2p: {
        peerDiscovery: [discoveryFactory]
      }
    });

    await waku.start();
    await delay(3000);

    const allPeers = await waku.libp2p.peerStore.all();
    console.log(`[Effect] Found ${allPeers.length} peers in peer store`);

    await waku.stop();
  });

  it(`should retrieve ${maxQuantity} multiaddrs for test.waku.nodes.status.im`, async function () {
    if (process.env.CI) this.skip();

    this.timeout(10000);
    // Google's dns server address. Needs to be set explicitly to run in CI
    const dnsNodeDiscovery = await DnsNodeDiscovery.dnsOverHttp();

    const peers = await dnsNodeDiscovery.getPeers([enrTree["SANDBOX"]], {
      relay: maxQuantity,
      store: maxQuantity,
      filter: maxQuantity,
      lightPush: maxQuantity
    });

    expect(peers.length).to.eq(maxQuantity);

    const multiaddrs = peers.map((peer) => peer.multiaddrs).flat();

    const seen: string[] = [];
    for (const ma of multiaddrs) {
      expect(ma).to.not.be.undefined;
      expect(seen).to.not.include(ma!.toString());
      seen.push(ma!.toString());
    }
  });
  it("passes more than one ENR URLs and attempts connection", async function () {
    if (process.env.CI) this.skip();
    this.timeout(30_000);

    const nodesToConnect = 2;

    const waku = await createLightNode({
      libp2p: {
        peerDiscovery: [
          wakuDnsDiscovery([enrTree["SANDBOX"], enrTree["TEST"]], {
            filter: nodesToConnect
          })
        ]
      }
    });

    await waku.start();

    const allPeers = await waku.libp2p.peerStore.all();
    while (allPeers.length < nodesToConnect) {
      await delay(2000);
    }
    expect(allPeers.length).to.be.eq(nodesToConnect);
  });
});

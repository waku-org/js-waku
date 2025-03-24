import { generateKeyPair } from "@libp2p/crypto/keys";
import { TypedEventEmitter } from "@libp2p/interface";
import tests from "@libp2p/interface-compliance-tests/peer-discovery";
import { prefixLogger } from "@libp2p/logger";
import { peerIdFromPrivateKey } from "@libp2p/peer-id";
import { persistentPeerStore } from "@libp2p/peer-store";
import {
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

      return new PeerDiscoveryDns(components, {
        enrUrls: [enrTree["SANDBOX"]]
      });
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

  it(`should use DNS peer discovery with light client`, async function () {
    this.timeout(100000);
    const minQuantityExpected = 3; // We have at least 3 nodes in Waku Sandbox ENR tree

    const waku = await createLightNode({
      libp2p: {
        peerDiscovery: [wakuDnsDiscovery([enrTree["SANDBOX"]])]
      }
    });

    await waku.start();

    const allPeers = await waku.libp2p.peerStore.all();
    let dnsPeers = 0;

    for (const peer of allPeers) {
      const hasTag = peer.tags.has("bootstrap");
      if (hasTag) {
        dnsPeers += 1;
      }
      expect(hasTag).to.be.eq(true);
    }
    expect(dnsPeers).to.gte(minQuantityExpected);
  });

  it(`should retrieve ${maxQuantity} multiaddrs for sandbox.waku.nodes.status.im`, async function () {
    if (process.env.CI) this.skip();

    this.timeout(10000);
    // Google's dns server address. Needs to be set explicitly to run in CI
    const dnsNodeDiscovery = await DnsNodeDiscovery.dnsOverHttp();

    const peers = [];
    for await (const peer of dnsNodeDiscovery.getNextPeer([
      enrTree["SANDBOX"]
    ])) {
      peers.push(peer);
    }

    expect(peers.length).to.eq(maxQuantity);

    const multiaddrs = peers.map((peer) => peer.multiaddrs).flat();

    const seen: string[] = [];
    for (const ma of multiaddrs) {
      expect(ma).to.not.be.undefined;
      expect(seen).to.not.include(ma!.toString());
      seen.push(ma!.toString());
    }
  });

  it(`should retrieve all multiaddrs when several ENR Tree URLs are passed`, async function () {
    if (process.env.CI) this.skip();

    this.timeout(10000);
    // Google's dns server address. Needs to be set explicitly to run in CI
    const dnsNodeDiscovery = await DnsNodeDiscovery.dnsOverHttp();

    const peers = [];
    for await (const peer of dnsNodeDiscovery.getNextPeer([
      enrTree["SANDBOX"],
      enrTree["TEST"]
    ])) {
      peers.push(peer);
    }

    expect(peers.length).to.eq(6);

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

    const minQuantityExpected = 2;

    const waku = await createLightNode({
      libp2p: {
        peerDiscovery: [wakuDnsDiscovery([enrTree["SANDBOX"], enrTree["TEST"]])]
      }
    });

    await waku.start();

    const allPeers = await waku.libp2p.peerStore.all();
    while (allPeers.length < minQuantityExpected) {
      await delay(2000);
    }
    expect(allPeers.length).to.be.gte(minQuantityExpected);
  });
});

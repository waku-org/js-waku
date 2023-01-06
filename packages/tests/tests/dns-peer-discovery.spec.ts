import tests from "@libp2p/interface-peer-discovery-compliance-tests";
import { createLightNode } from "@waku/create";
import {
  DnsNodeDiscovery,
  enrTree,
  wakuDnsDiscovery,
} from "@waku/dns-discovery";
import { expect } from "chai";

const maxQuantity = 3;

describe("DNS Discovery: Compliance Test", async function () {
  this.timeout(5000);
  tests({
    async setup() {
      return wakuDnsDiscovery(enrTree, {
        filter: 1,
      })();
    },
    async teardown() {
      //
    },
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
    const maxQuantity = 3;

    const nodeRequirements = {
      relay: maxQuantity,
      store: maxQuantity,
      filter: maxQuantity,
      lightPush: maxQuantity,
    };

    const waku = await createLightNode({
      libp2p: {
        peerDiscovery: [wakuDnsDiscovery(enrTree, nodeRequirements)],
      },
    });

    await waku.start();

    const peersFound = await waku.libp2p.peerStore.all();
    expect(peersFound.length).to.eq(maxQuantity);
  });

  it(`should retrieve ${maxQuantity} multiaddrs for prod.nodes.status.im`, async function () {
    this.timeout(10000);
    // Google's dns server address. Needs to be set explicitly to run in CI
    const dnsNodeDiscovery = DnsNodeDiscovery.dnsOverHttp();

    const peers = await dnsNodeDiscovery.getPeers([enrTree], {
      relay: maxQuantity,
      store: maxQuantity,
      filter: maxQuantity,
      lightPush: maxQuantity,
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
});

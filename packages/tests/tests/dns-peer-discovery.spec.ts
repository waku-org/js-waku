import tests from "@libp2p/interface-peer-discovery-compliance-tests";
import { Peer } from "@libp2p/interface-peer-store";
import { createLightNode } from "@waku/create";
import {
  DnsNodeDiscovery,
  enrTree,
  PeerDiscoveryDns,
  wakuDnsDiscovery,
} from "@waku/dns-discovery";
import { expect } from "chai";

const maxQuantity = 3;

describe("DNS Discovery: Compliance Test", async function () {
  this.timeout(10000);
  tests({
    async setup() {
      const node = await createLightNode();

      return new PeerDiscoveryDns(node.libp2p, {
        enrUrl: enrTree["PROD"],
        wantedNodeCapabilityCount: {
          filter: 1,
        },
      });
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
        peerDiscovery: [wakuDnsDiscovery(enrTree["PROD"], nodeRequirements)],
      },
    });

    await waku.start();

    const allPeers = await waku.libp2p.peerStore.all();

    const dnsPeers: Peer[] = [];

    for (const peer of allPeers) {
      const hasTag = (await waku.libp2p.peerStore.get(peer.id)).tags.has(
        "bootstrap"
      );
      if (hasTag) {
        dnsPeers.push(peer);
      }
      expect(hasTag).to.be.eq(true);
    }
    expect(dnsPeers.length).to.eq(maxQuantity);
  });

  it(`should retrieve ${maxQuantity} multiaddrs for test.waku.nodes.status.im`, async function () {
    if (process.env.CI) this.skip();

    this.timeout(10000);
    // Google's dns server address. Needs to be set explicitly to run in CI
    const dnsNodeDiscovery = await DnsNodeDiscovery.dnsOverHttp();

    const peers = await dnsNodeDiscovery.getPeers([enrTree["PROD"]], {
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

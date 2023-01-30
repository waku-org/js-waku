import { Components } from "@libp2p/components";
import tests from "@libp2p/interface-peer-discovery-compliance-tests";
import { Peer } from "@libp2p/interface-peer-store";
import { createEd25519PeerId } from "@libp2p/peer-id-factory";
import { PersistentPeerStore } from "@libp2p/peer-store";
import { createLightNode } from "@waku/create";
import {
  DnsNodeDiscovery,
  enrTree,
  PeerDiscoveryDns,
  wakuDnsDiscovery,
} from "@waku/dns-discovery";
import { expect } from "chai";
import { MemoryDatastore } from "datastore-core";

const maxQuantity = 3;

describe("DNS Discovery: Compliance Test", async function () {
  this.timeout(10000);
  tests({
    async setup() {
      // create libp2p mock peerStore
      const components = new Components({
        peerStore: new PersistentPeerStore({
          peerId: await createEd25519PeerId(),
          datastore: new MemoryDatastore(),
        }),
      });

      return new PeerDiscoveryDns(components, {
        enrUrl: enrTree,
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
        peerDiscovery: [wakuDnsDiscovery(enrTree, nodeRequirements)],
      },
    });

    await waku.start();

    const allPeers = await waku.libp2p.peerStore.all();

    const dnsPeers: Peer[] = [];

    for (const peer of allPeers) {
      const tags = await waku.libp2p.peerStore.getTags(peer.id);
      let hasTag = false;
      for (const tag of tags) {
        hasTag = tag.name === "bootstrap";
        if (hasTag) {
          dnsPeers.push(peer);
          break;
        }
      }
      expect(hasTag).to.be.eq(true);
    }
    expect(dnsPeers.length).to.eq(maxQuantity);
  });

  it(`should retrieve ${maxQuantity} multiaddrs for test.waku.nodes.status.im`, async function () {
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

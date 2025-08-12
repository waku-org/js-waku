import type { DnsClient } from "@waku/interfaces";
import { expect } from "chai";
import sinon from "sinon";

import { DnsNodeDiscovery } from "./dns.js";
import testData from "./testdata.json" with { type: "json" };

import { enrTree } from "./index.js";

const mockData = testData.dns;

const host = "nodes.example.org";
const rootDomain = "JORXBYVVM7AEKETX5DGXW44EAY";
const branchDomainA = "D2SNLTAGWNQ34NTQTPHNZDECFU";
const branchDomainB = "D3SNLTAGWNQ34NTQTPHNZDECFU";
const branchDomainC = "D4SNLTAGWNQ34NTQTPHNZDECFU";
const branchDomainD = "D5SNLTAGWNQ34NTQTPHNZDECFU";
const partialBranchA = "AAAA";
const partialBranchB = "BBBB";
const singleBranch = `enrtree-branch:${branchDomainA}`;
const multiComponentBranch = [
  `enrtree-branch:${branchDomainA},${partialBranchA}`,
  `${partialBranchB},${branchDomainB}`
];

// Note: once td.when is asked to throw for an input it will always throw.
// Input can't be re-used for a passing case.
const errorBranchA = `enrtree-branch:${branchDomainC}`;
const errorBranchB = `enrtree-branch:${branchDomainD}`;

/**
 * Mocks DNS resolution.
 */
class MockDNS implements DnsClient {
  private fqdnRes: Map<string, string[]>;
  private fqdnThrows: string[];
  public hasThrown: boolean;

  public constructor() {
    this.fqdnRes = new Map();
    this.fqdnThrows = [];
    this.hasThrown = false;
  }

  public addRes(fqdn: string, res: string[]): void {
    this.fqdnRes.set(fqdn, res);
  }

  public addThrow(fqdn: string): void {
    this.fqdnThrows.push(fqdn);
  }

  public resolveTXT(fqdn: string): Promise<string[]> {
    if (this.fqdnThrows.includes(fqdn)) {
      this.hasThrown = true;
      console.log("throwing");
      throw "Mock DNS throws.";
    }

    const res = this.fqdnRes.get(fqdn);

    if (!res) {
      this.hasThrown = true;
      throw `Mock DNS could not resolve ${fqdn}`;
    }

    return Promise.resolve(res);
  }
}

describe("DNS Node Discovery", () => {
  let mockDns: MockDNS;

  beforeEach(() => {
    mockDns = new MockDNS();
    mockDns.addRes(host, [mockData.enrRoot]);
  });

  it("retrieves a single peer", async function () {
    mockDns.addRes(`${rootDomain}.${host}`, [singleBranch]);
    mockDns.addRes(`${branchDomainA}.${host}`, [mockData.enrWithWaku2Relay]);

    const dnsNodeDiscovery = new DnsNodeDiscovery(mockDns);
    const peers = [];
    for await (const peer of dnsNodeDiscovery.getNextPeer([mockData.enrTree])) {
      peers.push(peer);
    }

    expect(peers.length).to.eq(1);
    expect(peers[0].ip).to.eq("192.168.178.251");
    expect(peers[0].tcp).to.eq(8002);
  });

  it("it tolerates circular branch references", async function () {
    // root --> branchA
    // branchA --> branchA
    mockDns.addRes(`${rootDomain}.${host}`, [singleBranch]);
    mockDns.addRes(`${branchDomainA}.${host}`, [singleBranch]);

    const dnsNodeDiscovery = new DnsNodeDiscovery(mockDns);
    const peers = [];
    for await (const peer of dnsNodeDiscovery.getNextPeer([mockData.enrTree])) {
      peers.push(peer);
    }

    expect(peers.length).to.eq(0);
  });

  it("recovers when dns.resolve returns empty", async function () {
    mockDns.addRes(`${rootDomain}.${host}`, [singleBranch]);

    // Empty response case
    mockDns.addRes(`${branchDomainA}.${host}`, []);

    const dnsNodeDiscovery = new DnsNodeDiscovery(mockDns);
    const peersA = [];
    for await (const peer of dnsNodeDiscovery.getNextPeer([mockData.enrTree])) {
      peersA.push(peer);
    }

    expect(peersA.length).to.eq(0);

    // No TXT records case
    mockDns.addRes(`${branchDomainA}.${host}`, []);

    const peersB = [];
    for await (const peer of dnsNodeDiscovery.getNextPeer([mockData.enrTree])) {
      peersB.push(peer);
    }
    expect(peersB.length).to.eq(0);
  });

  it("ignores domain fetching errors", async function () {
    mockDns.addRes(`${rootDomain}.${host}`, [errorBranchA]);
    mockDns.addThrow(`${branchDomainC}.${host}`);

    const dnsNodeDiscovery = new DnsNodeDiscovery(mockDns);
    const peers = [];
    for await (const peer of dnsNodeDiscovery.getNextPeer([mockData.enrTree])) {
      peers.push(peer);
    }
    expect(peers.length).to.eq(0);
  });

  it("ignores unrecognized TXT record formats", async function () {
    mockDns.addRes(`${rootDomain}.${host}`, [mockData.enrBranchBadPrefix]);
    const dnsNodeDiscovery = new DnsNodeDiscovery(mockDns);
    const peers = [];
    for await (const peer of dnsNodeDiscovery.getNextPeer([mockData.enrTree])) {
      peers.push(peer);
    }
    expect(peers.length).to.eq(0);
  });

  it("caches peers it previously fetched", async function () {
    mockDns.addRes(`${rootDomain}.${host}`, [errorBranchB]);
    mockDns.addRes(`${branchDomainD}.${host}`, [mockData.enrWithWaku2Relay]);

    const dnsNodeDiscovery = new DnsNodeDiscovery(mockDns);
    const peersA = [];
    for await (const peer of dnsNodeDiscovery.getNextPeer([mockData.enrTree])) {
      peersA.push(peer);
    }
    expect(peersA.length).to.eq(1);

    // Specify that a subsequent network call retrieving the same peer should throw.
    // This test passes only if the peer is fetched from cache
    mockDns.addThrow(`${branchDomainD}.${host}`);

    const peersB = [];
    for await (const peer of dnsNodeDiscovery.getNextPeer([mockData.enrTree])) {
      peersB.push(peer);
    }
    expect(peersB.length).to.eq(1);
    expect(peersA[0].ip).to.eq(peersB[0].ip);
    expect(mockDns.hasThrown).to.be.false;
  });
});

describe("DNS Node Discovery w/ capabilities", () => {
  let mockDns: MockDNS;

  beforeEach(() => {
    mockDns = new MockDNS();
    mockDns.addRes(host, [mockData.enrRoot]);
  });

  it("should only return 1 node with relay capability", async () => {
    mockDns.addRes(`${rootDomain}.${host}`, [mockData.enrWithWaku2Relay]);

    const dnsNodeDiscovery = new DnsNodeDiscovery(mockDns);
    const peers = [];
    for await (const peer of dnsNodeDiscovery.getNextPeer([mockData.enrTree])) {
      peers.push(peer);
    }

    expect(peers.length).to.eq(1);
    expect(peers[0].peerId?.toString()).to.eq(
      "16Uiu2HAmPsYLvfKafxgRsb6tioYyGnSvGXS2iuMigptHrqHPNPzx"
    );
  });

  it("should only return 1 node with relay and store capability", async () => {
    mockDns.addRes(`${rootDomain}.${host}`, [mockData.enrWithWaku2RelayStore]);

    const dnsNodeDiscovery = new DnsNodeDiscovery(mockDns);
    const peers = [];
    for await (const peer of dnsNodeDiscovery.getNextPeer([mockData.enrTree])) {
      peers.push(peer);
    }

    expect(peers.length).to.eq(1);
    expect(peers[0].peerId?.toString()).to.eq(
      "16Uiu2HAm2HyS6brcCspSbszG9i36re2bWBVjMe3tMdnFp1Hua34F"
    );
  });

  it("return first retrieved peers without further DNS queries", async function () {
    mockDns.addRes(`${rootDomain}.${host}`, multiComponentBranch);
    mockDns.addRes(`${branchDomainA}.${host}`, [
      mockData.enrWithWaku2RelayStore
    ]);
    // The ENR Tree is such as there are more branches to be explored.
    // But they should not be explored if it isn't asked
    mockDns.addThrow(`${branchDomainB}.${host}`);

    const dnsNodeDiscovery = new DnsNodeDiscovery(mockDns);

    const randomStub = sinon.stub(Math, "random").returns(0);
    try {
      const iterator = dnsNodeDiscovery.getNextPeer([mockData.enrTree]);
      const { value: peer } = await iterator.next();

      expect(peer.peerId?.toString()).to.eq(
        "16Uiu2HAm2HyS6brcCspSbszG9i36re2bWBVjMe3tMdnFp1Hua34F"
      );
      expect(mockDns.hasThrown).to.be.false;
    } finally {
      randomStub.restore();
    }
  });

  it("retrieves all peers (3) when branch entries are composed of multiple strings", async function () {
    mockDns.addRes(`${rootDomain}.${host}`, multiComponentBranch);
    mockDns.addRes(`${branchDomainA}.${host}`, [
      mockData.enrWithWaku2RelayStore
    ]);
    mockDns.addRes(`${branchDomainB}.${host}`, [mockData.enrWithWaku2Relay]);
    mockDns.addRes(`${partialBranchA}${partialBranchB}.${host}`, [
      mockData.enrWithWaku2Store
    ]);

    const dnsNodeDiscovery = new DnsNodeDiscovery(mockDns);
    const peers = [];
    for await (const peer of dnsNodeDiscovery.getNextPeer([mockData.enrTree])) {
      peers.push(peer);
    }

    expect(peers.length).to.eq(3);
    const peerIds = peers.map((p) => p.peerId?.toString());
    expect(peerIds).to.contain(
      "16Uiu2HAm2HyS6brcCspSbszG9i36re2bWBVjMe3tMdnFp1Hua34F"
    );
    expect(peerIds).to.contain(
      "16Uiu2HAmPsYLvfKafxgRsb6tioYyGnSvGXS2iuMigptHrqHPNPzx"
    );
    expect(peerIds).to.contain(
      "16Uiu2HAkv3La3ECgQpdYeEJfrX36EWdhkUDv4C9wvXM8TFZ9dNgd"
    );
  });
});

describe("DNS Node Discovery [live data]", function () {
  const maxQuantity = 3;

  before(function () {
    if (process.env.CI) {
      this.skip();
    }
  });

  it(`should retrieve ${maxQuantity} multiaddrs for test.waku.nodes.status.im`, async function () {
    this.timeout(10000);
    // Google's dns server address. Needs to be set explicitly to run in CI
    const dnsNodeDiscovery = await DnsNodeDiscovery.dnsOverHttp();
    const peers = [];
    for await (const peer of dnsNodeDiscovery.getNextPeer([enrTree.TEST])) {
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

  it(`should retrieve ${maxQuantity} multiaddrs for sandbox.waku.nodes.status.im`, async function () {
    this.timeout(10000);
    // Google's dns server address. Needs to be set explicitly to run in CI
    const dnsNodeDiscovery = await DnsNodeDiscovery.dnsOverHttp();
    const peers = [];
    for await (const peer of dnsNodeDiscovery.getNextPeer([enrTree.SANDBOX])) {
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
});

import { expect } from 'chai';

import { DNSNodeDiscovery } from './dns';
import testData from './testdata.json';

const mockData = testData.dns;

const host = 'nodes.example.org';
const rootDomain = 'JORXBYVVM7AEKETX5DGXW44EAY';
const branchDomainA = 'D2SNLTAGWNQ34NTQTPHNZDECFU';
const branchDomainB = 'D3SNLTAGWNQ34NTQTPHNZDECFU';
const branchDomainC = 'D4SNLTAGWNQ34NTQTPHNZDECFU';
const branchDomainD = 'D5SNLTAGWNQ34NTQTPHNZDECFU';
const partialBranchA = 'AAAA';
const partialBranchB = 'BBBB';
const singleBranch = `enrtree-branch:${branchDomainA}`;
const doubleBranch = `enrtree-branch:${branchDomainA},${branchDomainB}`;
const multiComponentBranch = [
  `enrtree-branch:${branchDomainA},${partialBranchA}`,
  `${partialBranchB},${branchDomainB}`,
];

// Note: once td.when is asked to throw for an input it will always throw.
// Input can't be re-used for a passing case.
const errorBranchA = `enrtree-branch:${branchDomainC}`;
const errorBranchB = `enrtree-branch:${branchDomainD}`;

/**
 * Mocks DNS resolution.
 */
class MockDNS {
  fqdnRes: Map<string, string[]>;
  fqdnThrows: string[];

  constructor() {
    this.fqdnRes = new Map();
    this.fqdnThrows = [];
  }

  addRes(fqdn: string, res: string[]): void {
    this.fqdnRes.set(fqdn, res);
  }

  addThrow(fqdn: string): void {
    this.fqdnThrows.push(fqdn);
  }

  resolve(
    fqdn: string,
    type: string
  ): Promise<{ answers: Array<{ data: string }> }> {
    if (type !== 'TXT') throw 'Expected TXT DNS queries.';

    if (this.fqdnThrows.includes(fqdn)) throw 'Mock DNS throws.';

    const res = this.fqdnRes.get(fqdn);

    if (!res) throw `Mock DNS could not resolve ${fqdn}}`;

    const answers = res.map((data) => {
      return {
        data: data,
      };
    });

    return Promise.resolve({
      answers,
    });
  }
}

describe('DNS Node Discovery', () => {
  let mockDns: MockDNS;

  beforeEach(() => {
    mockDns = new MockDNS();
    mockDns.addRes(host, [mockData.enrRoot]);
  });

  it('retrieves a single peer', async function () {
    mockDns.addRes(`${rootDomain}.${host}`, [singleBranch]);
    mockDns.addRes(`${branchDomainA}.${host}`, [mockData.enrA]);

    const dnsNodeDiscovery = new DNSNodeDiscovery(mockDns);
    const peers = await dnsNodeDiscovery.getPeers(1, [mockData.enrTree]);

    expect(peers.length).to.eq(1);
    expect(peers[0].address).to.eq('45.77.40.127');
    expect(peers[0].tcpPort).to.eq(30303);
  });

  it('retrieves all peers (2) when maxQuantity larger than DNS tree size', async function () {
    mockDns.addRes(`${rootDomain}.${host}`, [doubleBranch]);
    mockDns.addRes(`${branchDomainA}.${host}`, [mockData.enrA]);
    mockDns.addRes(`${branchDomainB}.${host}`, [mockData.enrB]);

    const dnsNodeDiscovery = new DNSNodeDiscovery(mockDns);
    const peers = await dnsNodeDiscovery.getPeers(50, [mockData.enrTree]);

    expect(peers.length).to.eq(2);
    expect(peers[0].address).to.not.eq(peers[1].address);
  });

  it('retrieves all peers (3) when branch entries are composed of multiple strings', async function () {
    mockDns.addRes(`${rootDomain}.${host}`, multiComponentBranch);
    mockDns.addRes(`${branchDomainA}.${host}`, [mockData.enr]);
    mockDns.addRes(`${branchDomainB}.${host}`, [mockData.enrA]);
    mockDns.addRes(`${partialBranchA}${partialBranchB}.${host}`, [
      mockData.enrB,
    ]);

    const dnsNodeDiscovery = new DNSNodeDiscovery(mockDns);
    const peers = await dnsNodeDiscovery.getPeers(50, [mockData.enrTree]);

    expect(peers.length).to.eq(3);
    expect(peers[0].address).to.not.eq(peers[1].address);
    expect(peers[0].address).to.not.eq(peers[2].address);
    expect(peers[1].address).to.not.eq(peers[2].address);
  });

  it('it tolerates circular branch references', async function () {
    // root --> branchA
    // branchA --> branchA
    mockDns.addRes(`${rootDomain}.${host}`, [singleBranch]);
    mockDns.addRes(`${branchDomainA}.${host}`, [singleBranch]);

    const dnsNodeDiscovery = new DNSNodeDiscovery(mockDns);
    const peers = await dnsNodeDiscovery.getPeers(1, [mockData.enrTree]);

    expect(peers.length).to.eq(0);
  });

  it('recovers when dns.resolve returns empty', async function () {
    mockDns.addRes(`${rootDomain}.${host}`, [singleBranch]);

    // Empty response case
    mockDns.addRes(`${branchDomainA}.${host}`, []);

    const dnsNodeDiscovery = new DNSNodeDiscovery(mockDns);
    let peers = await dnsNodeDiscovery.getPeers(1, [mockData.enrTree]);

    expect(peers.length).to.eq(0);

    // No TXT records case
    mockDns.addRes(`${branchDomainA}.${host}`, []);

    peers = await dnsNodeDiscovery.getPeers(1, [mockData.enrTree]);
    expect(peers.length).to.eq(0);
  });

  it('ignores domain fetching errors', async function () {
    mockDns.addRes(`${rootDomain}.${host}`, [errorBranchA]);
    mockDns.addThrow(`${branchDomainC}.${host}`);

    const dnsNodeDiscovery = new DNSNodeDiscovery(mockDns);
    const peers = await dnsNodeDiscovery.getPeers(1, [mockData.enrTree]);
    expect(peers.length).to.eq(0);
  });

  it('ignores unrecognized TXT record formats', async function () {
    mockDns.addRes(`${rootDomain}.${host}`, [mockData.enrBranchBadPrefix]);
    const dnsNodeDiscovery = new DNSNodeDiscovery(mockDns);
    const peers = await dnsNodeDiscovery.getPeers(1, [mockData.enrTree]);
    expect(peers.length).to.eq(0);
  });

  it('caches peers it previously fetched', async function () {
    mockDns.addRes(`${rootDomain}.${host}`, [errorBranchB]);
    mockDns.addRes(`${branchDomainD}.${host}`, [mockData.enrA]);

    const dnsNodeDiscovery = new DNSNodeDiscovery(mockDns);
    const peersA = await dnsNodeDiscovery.getPeers(1, [mockData.enrTree]);
    expect(peersA.length).to.eq(1);

    // Specify that a subsequent network call retrieving the same peer should throw.
    // This test passes only if the peer is fetched from cache
    mockDns.addThrow(`${branchDomainD}.${host}`);

    const peersB = await dnsNodeDiscovery.getPeers(1, [mockData.enrTree]);
    expect(peersB.length).to.eq(1);
    expect(peersA[0].address).to.eq(peersB[0].address);
  });
});

describe('DNS Node Discovery [live data]', function () {
  const publicKey = 'AOFTICU2XWDULNLZGRMQS4RIZPAZEHYMV4FYHAPW563HNRAOERP7C';
  const fqdn = 'test.nodes.vac.dev';
  const enrTree = `enrtree://${publicKey}@${fqdn}`;
  const ipTestRegex = /^\d+\.\d+\.\d+\.\d+$/;
  const maxQuantity = 3;

  it(`should retrieve ${maxQuantity} PeerInfos for test.nodes.vac.dev`, async function () {
    // Google's dns server address. Needs to be set explicitly to run in CI
    const dnsNodeDiscovery = new DNSNodeDiscovery();
    const peers = await dnsNodeDiscovery.getPeers(maxQuantity, [enrTree]);

    expect(peers.length).to.eq(maxQuantity);

    const seen: string[] = [];
    for (const peer of peers) {
      expect(peer!.address!).to.match(ipTestRegex);
      expect(seen).to.not.include(peer!.address!);
      seen.push(peer!.address!);
    }
  });
});

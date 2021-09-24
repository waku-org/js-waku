import { expect } from 'chai';

import { ENR } from './enr';
import testdata from './testdata.json';

const dns = testdata.dns;

describe('ENR', () => {
  // Root DNS entries
  it('ENR (root): should parse and verify and DNS root entry', () => {
    const subdomain = ENR.parseAndVerifyRoot(dns.enrRoot, dns.publicKey);

    expect(subdomain).to.eq('JORXBYVVM7AEKETX5DGXW44EAY');
  });

  it('ENR (root): should error if DNS root entry is mis-prefixed', () => {
    try {
      ENR.parseAndVerifyRoot(dns.enrRootBadPrefix, dns.publicKey);
    } catch (e) {
      expect(e.toString()).includes(
        "ENR root entry must start with 'enrtree-root:'"
      );
    }
  });

  it('ENR (root): should error if DNS root entry signature is invalid', () => {
    try {
      ENR.parseAndVerifyRoot(dns.enrRootBadSig, dns.publicKey);
    } catch (e) {
      expect(e.toString()).includes('Unable to verify ENR root signature');
    }
  });

  it('ENR (root): should error if DNS root entry is malformed', () => {
    try {
      ENR.parseAndVerifyRoot(dns.enrRootMalformed, dns.publicKey);
    } catch (e) {
      expect(e.toString()).includes(
        "Could not parse 'l' value from ENR root entry"
      );
    }
  });

  // Tree DNS entries
  it('ENR (tree): should parse a DNS tree entry', () => {
    const { publicKey, domain } = ENR.parseTree(dns.enrTree);

    expect(publicKey).to.eq(dns.publicKey);
    expect(domain).to.eq('nodes.example.org');
  });

  it('ENR (tree): should error if DNS tree entry is mis-prefixed', () => {
    try {
      ENR.parseTree(dns.enrTreeBadPrefix);
    } catch (e) {
      expect(e.toString()).includes(
        "ENR tree entry must start with 'enrtree:'"
      );
    }
  });

  it('ENR (tree): should error if DNS tree entry is misformatted', () => {
    try {
      ENR.parseTree(dns.enrTreeMalformed);
    } catch (e) {
      expect(e.toString()).includes(
        'Could not parse domain from ENR tree entry'
      );
    }
  });

  // Branch entries
  it('ENR (branch): should parse and verify a single component DNS branch entry', () => {
    const expected = [
      'D2SNLTAGWNQ34NTQTPHNZDECFU',
      '67BLTJEU5R2D5S3B4QKJSBRFCY',
      'A2HDMZBB4JIU53VTEGC4TG6P4A',
    ];

    const branches = ENR.parseBranch(dns.enrBranch);
    expect(branches).to.deep.eq(expected);
  });

  it('ENR (branch): should error if DNS branch entry is mis-prefixed', () => {
    try {
      ENR.parseBranch(dns.enrBranchBadPrefix);
    } catch (e) {
      expect(e.toString()).includes(
        "ENR branch entry must start with 'enrtree-branch:'"
      );
    }
  });

  // ENR DNS entries
  it('ENR (enr): should convert an Ethereum Name Record string', () => {
    const { address, tcpPort, udpPort } = ENR.parseAndVerifyRecord(dns.enr);

    expect(address).to.eq('40.113.111.135');
    expect(tcpPort).to.eq(30303);
    expect(udpPort).to.eq(30303);
  });

  it('ENR (enr): should return correct multiaddr conversion codes for ipv6', () => {
    const expected = { ipCode: 41, tcpCode: 6, udpCode: 273 };
    const protocolId = Buffer.from('v6');
    const codes = ENR._getIpProtocolConversionCodes(protocolId);

    expect(codes).to.deep.eq(expected);
  });

  it('ENR (enr): should error if record mis-prefixed', () => {
    try {
      ENR.parseAndVerifyRecord(dns.enrBadPrefix);
    } catch (e) {
      expect(e.toString()).includes(
        "String encoded ENR must start with 'enr:'"
      );
    }
  });

  it('ENR (enr): should error when converting to unrecognized ip protocol id', () => {
    const protocolId = Buffer.from('v7');
    try {
      ENR._getIpProtocolConversionCodes(protocolId);
    } catch (e) {
      expect(e.toString()).includes("IP protocol must be 'v4' or 'v6'");
    }
  });
});

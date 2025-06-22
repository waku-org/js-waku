import { expect } from "chai";

import { ENRTree } from "./enrtree.js";
import testData from "./testdata.json" with { type: "json" };

const dns = testData.dns;

describe("ENRTree", () => {
  // Root DNS entries
  it("ENRTree (root): should parse and verify and DNS root entry", () => {
    const subdomain = ENRTree.parseAndVerifyRoot(dns.enrRoot, dns.publicKey);

    expect(subdomain).to.eq("JORXBYVVM7AEKETX5DGXW44EAY");
  });

  it("ENRTree (root): should error if DNS root entry is mis-prefixed", () => {
    try {
      ENRTree.parseAndVerifyRoot(dns.enrRootBadPrefix, dns.publicKey);
    } catch (err: unknown) {
      const e = err as Error;
      expect(e.toString()).includes(
        "ENRTree root entry must start with 'enrtree-root:'"
      );
    }
  });

  it("ENRTree (root): should error if DNS root entry signature is invalid", () => {
    try {
      ENRTree.parseAndVerifyRoot(dns.enrRootBadSig, dns.publicKey);
    } catch (err: unknown) {
      const e = err as Error;
      expect(e.toString()).includes("Unable to verify ENRTree root signature");
    }
  });

  it("ENRTree (root): should error if DNS root entry is malformed", () => {
    try {
      ENRTree.parseAndVerifyRoot(dns.enrRootMalformed, dns.publicKey);
    } catch (err: unknown) {
      const e = err as Error;
      expect(e.toString()).includes("Could not parse ENRTree root entry");
    }
  });

  // Tree DNS entries
  it("ENRTree (tree): should parse a DNS tree entry", () => {
    const { publicKey, domain } = ENRTree.parseTree(dns.enrTree);

    expect(publicKey).to.eq(dns.publicKey);
    expect(domain).to.eq("nodes.example.org");
  });

  it("ENRTree (tree): should error if DNS tree entry is mis-prefixed", () => {
    try {
      ENRTree.parseTree(dns.enrTreeBadPrefix);
    } catch (err: unknown) {
      const e = err as Error;
      expect(e.toString()).includes(
        "ENRTree tree entry must start with 'enrtree:'"
      );
    }
  });

  it("ENRTree (tree): should error if DNS tree entry is misformatted", () => {
    try {
      ENRTree.parseTree(dns.enrTreeMalformed);
    } catch (err: unknown) {
      const e = err as Error;
      expect(e.toString()).includes("Could not parse ENRTree tree entry");
    }
  });

  // Branch entries
  it("ENRTree (branch): should parse and verify a single component DNS branch entry", () => {
    const expected = [
      "D2SNLTAGWNQ34NTQTPHNZDECFU",
      "67BLTJEU5R2D5S3B4QKJSBRFCY",
      "A2HDMZBB4JIU53VTEGC4TG6P4A"
    ];

    const branches = ENRTree.parseBranch(dns.enrBranch);
    expect(branches).to.deep.eq(expected);
  });

  it("ENRTree (branch): should error if DNS branch entry is mis-prefixed", () => {
    try {
      ENRTree.parseBranch(dns.enrBranchBadPrefix);
    } catch (err: unknown) {
      const e = err as Error;
      expect(e.toString()).includes(
        "ENRTree branch entry must start with 'enrtree-branch:'"
      );
    }
  });
});

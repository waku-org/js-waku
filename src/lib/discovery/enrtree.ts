import assert from "assert";

import * as secp from "@noble/secp256k1";
import * as base32 from "hi-base32";
import { fromString } from "uint8arrays/from-string";

import { ENR } from "../enr";
import { keccak256Buf, utf8ToBytes } from "../utils";

export type ENRRootValues = {
  eRoot: string;
  lRoot: string;
  seq: number;
  signature: string;
};

export type ENRTreeValues = {
  publicKey: string;
  domain: string;
};

export class ENRTree {
  public static readonly RECORD_PREFIX = ENR.RECORD_PREFIX;
  public static readonly TREE_PREFIX = "enrtree:";
  public static readonly BRANCH_PREFIX = "enrtree-branch:";
  public static readonly ROOT_PREFIX = "enrtree-root:";

  /**
   * Extracts the branch subdomain referenced by a DNS tree root string after verifying
   * the root record signature with its base32 compressed public key.
   */
  static parseAndVerifyRoot(root: string, publicKey: string): string {
    assert(
      root.startsWith(this.ROOT_PREFIX),
      `ENRTree root entry must start with '${this.ROOT_PREFIX}'`
    );

    const rootValues = ENRTree.parseRootValues(root);
    const decodedPublicKey = base32.decode.asBytes(publicKey);

    // The signature is a 65-byte secp256k1 over the keccak256 hash
    // of the record content, excluding the `sig=` part, encoded as URL-safe base64 string
    // (Trailing recovery bit must be trimmed to pass `ecdsaVerify` method)
    const signedComponent = root.split(" sig")[0];
    const signedComponentBuffer = utf8ToBytes(signedComponent);
    const signatureBuffer = fromString(rootValues.signature, "base64url").slice(
      0,
      64
    );

    let isVerified;
    try {
      const _sig = secp.Signature.fromCompact(signatureBuffer.slice(0, 64));
      isVerified = secp.verify(
        _sig,
        keccak256Buf(signedComponentBuffer),
        new Uint8Array(decodedPublicKey)
      );
    } catch {
      isVerified = false;
    }

    assert(isVerified, "Unable to verify ENRTree root signature");

    return rootValues.eRoot;
  }

  static parseRootValues(txt: string): ENRRootValues {
    const matches = txt.match(
      /^enrtree-root:v1 e=([^ ]+) l=([^ ]+) seq=(\d+) sig=([^ ]+)$/
    );

    assert.ok(Array.isArray(matches), "Could not parse ENRTree root entry");

    matches.shift(); // The first entry is the full match
    const [eRoot, lRoot, seq, signature] = matches;

    assert.ok(eRoot, "Could not parse 'e' value from ENRTree root entry");
    assert.ok(lRoot, "Could not parse 'l' value from ENRTree root entry");
    assert.ok(seq, "Could not parse 'seq' value from ENRTree root entry");
    assert.ok(signature, "Could not parse 'sig' value from ENRTree root entry");

    return { eRoot, lRoot, seq: Number(seq), signature };
  }

  /**
   * Returns the public key and top level domain of an ENR tree entry.
   * The domain is the starting point for traversing a set of linked DNS TXT records
   * and the public key is used to verify the root entry record
   */
  static parseTree(tree: string): ENRTreeValues {
    assert(
      tree.startsWith(this.TREE_PREFIX),
      `ENRTree tree entry must start with '${this.TREE_PREFIX}'`
    );

    const matches = tree.match(/^enrtree:\/\/([^@]+)@(.+)$/);

    assert.ok(Array.isArray(matches), "Could not parse ENRTree tree entry");

    matches.shift(); // The first entry is the full match
    const [publicKey, domain] = matches;

    assert.ok(publicKey, "Could not parse public key from ENRTree tree entry");
    assert.ok(domain, "Could not parse domain from ENRTree tree entry");

    return { publicKey, domain };
  }

  /**
   * Returns subdomains listed in an ENR branch entry. These in turn lead to
   * either further branch entries or ENR records.
   */
  static parseBranch(branch: string): string[] {
    assert(
      branch.startsWith(this.BRANCH_PREFIX),
      `ENRTree branch entry must start with '${this.BRANCH_PREFIX}'`
    );

    return branch.split(this.BRANCH_PREFIX)[1].split(",");
  }
}

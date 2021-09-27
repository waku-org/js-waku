import assert from 'assert';

import { debug } from 'debug';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore: No types available
import DNS from 'dns2';

import { PeerInfo } from './enr';
import { ENR } from './enr';

const dbg = debug('waku:discovery:dns');

type SearchContext = {
  domain: string;
  publicKey: string;
  visits: { [key: string]: boolean };
};

export class DNSNodeDiscovery {
  private readonly dns: DNS;
  private _DNSTreeCache: { [key: string]: string };
  private readonly _errorTolerance: number = 10;

  constructor(dns?: DNS) {
    this._DNSTreeCache = {};
    if (dns) {
      this.dns = dns;
    } else {
      this.dns = new DNS();
    }
  }

  /**
   * Returns a list of verified peers listed in an EIP-1459 DNS tree. Method may
   * return fewer peers than requested if `maxQuantity` is larger than the number
   * of ENR records or the number of errors/duplicate peers encountered by randomized
   * search exceeds `maxQuantity` plus the `errorTolerance` factor.
   */
  async getPeers(
    maxQuantity: number,
    dnsNetworks: string[]
  ): Promise<PeerInfo[]> {
    let totalSearches = 0;
    const peers: PeerInfo[] = [];

    const networkIndex = Math.floor(Math.random() * dnsNetworks.length);
    const { publicKey, domain } = ENR.parseTree(dnsNetworks[networkIndex]);

    while (
      peers.length < maxQuantity &&
      totalSearches < maxQuantity + this._errorTolerance
    ) {
      const context: SearchContext = {
        domain,
        publicKey,
        visits: {},
      };

      const peer = await this._search(domain, context);

      if (peer && isNewPeer(peer, peers)) {
        peers.push(peer);
        dbg(`got new peer candidate from DNS address=${JSON.stringify(peer)}`);
      }

      totalSearches++;
    }
    return peers;
  }

  /**
   * Runs a recursive, randomized descent of the DNS tree to retrieve a single
   * ENR record as a PeerInfo object. Returns null if parsing or DNS resolution fails.
   */
  private async _search(
    subdomain: string,
    context: SearchContext
  ): Promise<PeerInfo | null> {
    const entry = await this._getTXTRecord(subdomain, context);
    context.visits[subdomain] = true;

    let next: string;
    let branches: string[];

    const entryType = getEntryType(entry);
    try {
      switch (entryType) {
        case ENR.ROOT_PREFIX:
          next = ENR.parseAndVerifyRoot(entry, context.publicKey);
          return await this._search(next, context);
        case ENR.BRANCH_PREFIX:
          branches = ENR.parseBranch(entry);
          next = selectRandomPath(branches, context);
          return await this._search(next, context);
        case ENR.RECORD_PREFIX:
          return ENR.parseAndVerifyRecord(entry);
        default:
          return null;
      }
    } catch (error) {
      dbg(
        `Failed to search DNS tree ${entryType} at subdomain ${subdomain}: ${error}`
      );
      return null;
    }
  }

  /**
   * Retrieves the TXT record stored at a location from either
   * this DNS tree cache or via DNS query
   */
  private async _getTXTRecord(
    subdomain: string,
    context: SearchContext
  ): Promise<string> {
    if (this._DNSTreeCache[subdomain]) {
      return this._DNSTreeCache[subdomain];
    }

    // Location is either the top level tree entry host or a subdomain of it.
    const location =
      subdomain !== context.domain
        ? `${subdomain}.${context.domain}`
        : context.domain;

    const response = await this.dns
      .resolve(location, 'TXT')
      .then((res: { answers: Array<{ data: string }> }) =>
        res.answers.map((answer: { data: string }) => answer.data)
      );

    assert(
      response.length,
      'Received empty result array while fetching TXT record'
    );
    assert(response[0].length, 'Received empty TXT record');

    if (response.length > 1) {
      dbg(`Warning, DNS TXT value ${location} may be omitted`, response);
    }

    this._DNSTreeCache[subdomain] = response[0];
    return response[0];
  }
}

function getEntryType(entry: string): string {
  if (entry.startsWith(ENR.ROOT_PREFIX)) return ENR.ROOT_PREFIX;
  if (entry.startsWith(ENR.BRANCH_PREFIX)) return ENR.BRANCH_PREFIX;
  if (entry.startsWith(ENR.RECORD_PREFIX)) return ENR.RECORD_PREFIX;

  return '';
}

/**
 * Returns a randomly selected subdomain string from the list provided by a branch
 * entry record.
 *
 * The client must track subdomains which are already resolved to avoid
 * going into an infinite loop b/c branch entries can contain
 * circular references. It’s in the client’s best interest to traverse the
 * tree in random order.
 */
function selectRandomPath(branches: string[], context: SearchContext): string {
  // Identify domains already visited in this traversal of the DNS tree.
  // Then filter against them to prevent cycles.
  const circularRefs: { [key: number]: boolean } = {};
  for (const [idx, subdomain] of branches.entries()) {
    if (context.visits[subdomain]) {
      circularRefs[idx] = true;
    }
  }
  // If all possible paths are circular...
  if (Object.keys(circularRefs).length === branches.length) {
    throw new Error('Unresolvable circular path detected');
  }

  // Randomly select a viable path
  let index;
  do {
    index = Math.floor(Math.random() * branches.length);
  } while (circularRefs[index]);

  return branches[index];
}

/**
 * Returns false if candidate peer already exists in the
 * current collection of peers.
 * Returns true otherwise.
 */
function isNewPeer(peer: PeerInfo | null, peers: PeerInfo[]): boolean {
  if (!peer || !peer.address) return false;

  for (const existingPeer of peers) {
    if (peer.address === existingPeer.address) {
      return false;
    }
  }

  return true;
}

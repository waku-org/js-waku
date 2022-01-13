import debug from 'debug';
import { Multiaddr } from 'multiaddr';

import { DnsNodeDiscovery } from './dns';

import { getNodesFromHostedJson, getPseudoRandomSubset } from './index';

const dbg = debug('waku:discovery:bootstrap');

export const DefaultMaxPeers = 1;

export type BootstrapFn = () => Promise<Multiaddr[]>;

/**
 * Setup discovery method used to bootstrap.
 *
 * Only one method is used. `default`, `peers`, `getPeers` and `enr` options are mutually exclusive.
 */
export interface BootstrapOptions {
  /**
   * The maximum of peers to connect to as part of the bootstrap process.
   *
   * @default [[DefaultMaxPeers]]
   */
  maxPeers?: number;
  /**
   * Use the default discovery method. Overrides all other options but `maxPeers`
   *
   * The default discovery method is likely to change overtime as new discovery
   * methods are implemented.
   *
   * @default false
   */
  default?: boolean;
  /**
   * Multiaddrs of peers to connect to.
   */
  peers?: string[];
  /**
   * Getter that retrieve multiaddrs of peers to connect to.
   */
  getPeers?: () => Promise<string[] | Multiaddr[]>;
  /**
   * An EIP-1459 ENR Tree URL. For example:
   * "enrtree://AOFTICU2XWDULNLZGRMQS4RIZPAZEHYMV4FYHAPW563HNRAOERP7C@test.nodes.vac.dev"
   */
  enrUrl?: string;
}

/**
 * Parse the bootstrap options and returns an async function that returns node addresses upon invocation.
 */
export function parseBootstrap(opts: BootstrapOptions): BootstrapFn {
  const maxPeers = opts.maxPeers ?? DefaultMaxPeers;

  if (opts.default) {
    dbg('Bootstrap: Use hosted list of peers.');

    return getNodesFromHostedJson.bind({}, undefined, undefined, maxPeers);
  } else if (opts.peers !== undefined && opts.peers.length > 0) {
    dbg('Bootstrap: Use provided list of peers.');

    const allPeers: Multiaddr[] = opts.peers.map(
      (node: string) => new Multiaddr(node)
    );
    const peers = getPseudoRandomSubset(allPeers, maxPeers);
    return (): Promise<Multiaddr[]> => Promise.resolve(peers);
  } else if (typeof opts.getPeers === 'function') {
    dbg('Bootstrap: Use provided getPeers function.');
    const getPeers = opts.getPeers;

    return async (): Promise<Multiaddr[]> => {
      const allPeers = await getPeers();
      return getPseudoRandomSubset<string | Multiaddr>(allPeers, maxPeers).map(
        (node) => new Multiaddr(node)
      );
    };
  } else if (opts.enrUrl) {
    const enrUrl = opts.enrUrl;
    dbg('Bootstrap: Use provided EIP-1459 ENR Tree URL.');

    const dns = DnsNodeDiscovery.dnsOverHttp();

    return async (): Promise<Multiaddr[]> => {
      const enrs = await dns.getPeers(maxPeers, [enrUrl]);
      const addresses: Multiaddr[] = [];
      enrs.forEach((enr) => {
        if (!enr.multiaddrs) return;

        enr.multiaddrs.forEach((ma: Multiaddr) => {
          // Only return secure websocket addresses
          if (ma.protoNames().includes('wss')) {
            addresses.push(ma);
          }
        });
      });
      return addresses;
    };
  } else {
    dbg('No bootstrap method specified, no peer will be returned');
    return (): Promise<Multiaddr[]> => Promise.resolve([]);
  }
}

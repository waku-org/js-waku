import { getBootstrapNodes, getPseudoRandomSubset } from './index';
import debug from 'debug';
import { DnsNodeDiscovery } from './dns';

const dbg = debug("waku:discovery:bootstrap");

const DefaultMaxPeers = 1;

/**
 * Setup discovery method used to bootstrap.
 *
 * Only one method is used. `default`, `peers`, `getPeers` and `enr` options are mutually exclusive.
 */
export interface BootstrapOptions {
  /**
   * The maximum of peers to connect to as part of the bootstrap process.
   *
   * @default 1
   */
  maxPeers?: number;
  /**
   * Use the default discovery method.
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
  getPeers?:  () => Promise<string[]>;
  /**
   * An EIP-1459 ENR Tree URL. For example:
   * "enrtree://AOFTICU2XWDULNLZGRMQS4RIZPAZEHYMV4FYHAPW563HNRAOERP7C@test.nodes.vac.dev"
   */
  enrUrl?: string;
}

/**
 * Parse the bootstrap options and returns an async function that returns node addresses upon invocation.
 */
export function parseBootstrap(options: BootstrapOptions | boolean | string[] | (() => string[] | Promise<string[]>)): undefined | (() => Promise<string[]>) {
  if (Object.keys(options).includes('default')||
    Object.keys(options).includes('maxPeers')||
    Object.keys(options).includes('peers')||
    Object.keys(options).includes('getPeers')||
    Object.keys(options).includes('enrUrl')) {

    const opts = options as unknown as BootstrapOptions;
    const maxPeers = opts.maxPeers || DefaultMaxPeers;

    if (opts.default) {
      dbg("Bootstrap: Use hosted list of peers.")

      return getBootstrapNodes.bind({}, undefined, undefined, maxPeers);
    } else if (opts.peers !== undefined && opts.peers.length > 0) {
      dbg("Bootstrap: Use provided list of peers.")

      const allPeers: string[] = opts.peers;
      return () => {
        const peers = getPseudoRandomSubset(allPeers, maxPeers)
        return Promise.resolve(peers);
      };
    } else if (typeof opts.getPeers === 'function') {
      dbg("Bootstrap: Use provided getPeers function.");
      const getPeers = opts.getPeers;

      return async () => {
        const allPeers = await getPeers();
        return getPseudoRandomSubset(allPeers, maxPeers)
      };

    } else if (!!opts.enrUrl) {
      dbg("Bootstrap: Use provided EIP-1459 ENR Tree URL.");

      const dns = DnsNodeDiscovery.dnsOverHttp()
      return dns.getPeers.bind({},maxPeers,[opts.enrUrl])
    }




  } else {
    dbg("WARN: This bootstrap method will be deprecated, use `BootstrapOptions` instead");
    if (options === true) {
      return getBootstrapNodes;
    } else if (Array.isArray(options)) {
      return () => {
        return Promise.resolve(options as string[]);
      };
    } else if (typeof options === 'function') {
      return async () => {
        return options();
      };
    }
  }

}

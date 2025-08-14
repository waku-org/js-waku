/**
 * Options for the discovery.
 */
export type DiscoveryOptions = {
  peerExchange: boolean;
  dns: boolean;
  peerCache: boolean;
};

/**
 * Partial peer information used to store in the cache.
 */
export type PartialPeerInfo = {
  id: string;
  multiaddrs: string[];
};

/**
 * A cache interface for persisting peer information.
 */
export type PeerCache = {
  /**
   * Get the peer information from the cache.
   *
   * @returns The peer information from the cache or empty array if no peer information is found.
   */
  get: () => PartialPeerInfo[];

  /**
   * Set the peer information in the cache.
   *
   * @param value The peer information to set in the cache.
   */
  set: (value: PartialPeerInfo[]) => void;

  /**
   * Remove the peer information from the cache.
   */
  remove: () => void;
};

/**
 * Options for the peer cache discovery.
 */
export type PeerCacheDiscoveryOptions = {
  /**
   * The cache to use for getting and storing cached peer information.
   *
   * @default LocalStorage
   */
  cache: PeerCache;
};

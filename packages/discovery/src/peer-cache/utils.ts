import type { PartialPeerInfo, PeerCache } from "@waku/interfaces";

const isValidStoredPeer = (peer: unknown): boolean => {
  return (
    !!peer &&
    typeof peer === "object" &&
    "id" in peer &&
    typeof peer.id === "string" &&
    "multiaddrs" in peer &&
    Array.isArray(peer.multiaddrs)
  );
};

/**
 * A noop cache that will be used in environments where localStorage is not available.
 */
class NoopCache implements PeerCache {
  public get(): PartialPeerInfo[] {
    return [];
  }

  public set(_value: PartialPeerInfo[]): void {
    return;
  }

  public remove(): void {
    return;
  }
}

/**
 * A cache that uses localStorage to store peer information.
 */
class LocalStorageCache implements PeerCache {
  public get(): PartialPeerInfo[] {
    try {
      const cachedPeers = localStorage.getItem("waku:peers");
      const peers = cachedPeers ? JSON.parse(cachedPeers) : [];

      return peers.filter(isValidStoredPeer);
    } catch (e) {
      return [];
    }
  }

  public set(_value: PartialPeerInfo[]): void {
    try {
      localStorage.setItem("waku:peers", JSON.stringify(_value));
    } catch (e) {
      // ignore
    }
  }

  public remove(): void {
    try {
      localStorage.removeItem("waku:peers");
    } catch (e) {
      // ignore
    }
  }
}

export const defaultCache = (): PeerCache => {
  try {
    if (typeof localStorage !== "undefined") {
      return new LocalStorageCache();
    }
  } catch (_e) {
    // ignore
  }

  return new NoopCache();
};

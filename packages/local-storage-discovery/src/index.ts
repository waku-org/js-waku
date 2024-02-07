import { TypedEventEmitter } from "@libp2p/interface";
import {
  CustomEvent,
  PeerDiscovery,
  PeerDiscoveryEvents,
  PeerInfo,
  PeerUpdate,
  Startable
} from "@libp2p/interface";
import { createFromJSON } from "@libp2p/peer-id-factory";
import { multiaddr } from "@multiformats/multiaddr";
import {
  type Libp2pComponents,
  type LocalStoragePeerInfo,
  Tags
} from "@waku/interfaces";
import { Logger } from "@waku/utils";

const log = new Logger("peer-exchange-discovery");

type LocalStorageDiscoveryOptions = {
  tagValue?: number;
  tagTTL?: number;
};

export const DEFAULT_LOCAL_TAG_NAME = Tags.LOCAL;
const DEFAULT_LOCAL_TAG_VALUE = 50;
const DEFAULT_LOCAL_TAG_TTL = 100_000_000;

export class LocalStorageDiscovery
  extends TypedEventEmitter<PeerDiscoveryEvents>
  implements PeerDiscovery, Startable
{
  private isStarted: boolean;

  constructor(
    private readonly components: Libp2pComponents,
    private readonly options?: LocalStorageDiscoveryOptions
  ) {
    super();
    this.isStarted = false;
  }

  get [Symbol.toStringTag](): string {
    return "@waku/local-storage-discovery";
  }

  async start(): Promise<void> {
    if (this.isStarted) {
      return;
    }

    log.info("Starting Local Storage Discovery");

    this.components.events.addEventListener("peer:update", this.handleNewPeers);

    const localStoragePeers = this.getPeersFromLocalStorage();

    for (const { id: idStr, address } of localStoragePeers) {
      const peerId = await createFromJSON({
        id: idStr
      });

      if (await this.components.peerStore.has(peerId)) return;

      await this.components.peerStore.save(peerId, {
        tags: {
          [DEFAULT_LOCAL_TAG_NAME]: {
            value: this.options?.tagValue ?? DEFAULT_LOCAL_TAG_VALUE,
            ttl: this.options?.tagTTL ?? DEFAULT_LOCAL_TAG_TTL
          }
        }
      });

      this.dispatchEvent(
        new CustomEvent<PeerInfo>("peer", {
          detail: {
            id: peerId,
            multiaddrs: [multiaddr(address)]
          }
        })
      );
    }

    log.info(`Discovered ${localStoragePeers.length} peers`);
  }

  stop(): void | Promise<void> {
    if (!this.isStarted) return;
    log.info("Stopping Local Storage Discovery");
    this.components.events.removeEventListener(
      "peer:update",
      this.handleNewPeers
    );
    this.isStarted = false;
  }

  handleNewPeers = (event: CustomEvent<PeerUpdate>): void => {
    const { peer } = event.detail;

    const websocketMultiaddr = peer.addresses.find((addr) =>
      addr.toString().includes("ws" || "wss")
    );
    if (!websocketMultiaddr) return;

    const localStoragePeers = this.getPeersFromLocalStorage();

    const existingPeerIndex = localStoragePeers.findIndex(
      (_peer) => _peer.id === peer.id.toString()
    );

    if (existingPeerIndex >= 0) {
      localStoragePeers[existingPeerIndex].address =
        websocketMultiaddr.toString();
    } else {
      localStoragePeers.push({
        id: peer.id.toString(),
        address: websocketMultiaddr.toString()
      });
    }

    this.setPeersInLocalStorage(localStoragePeers);
  };

  private getPeersFromLocalStorage(): LocalStoragePeerInfo[] {
    try {
      const storedPeersData = localStorage.getItem("waku:peers");
      if (!storedPeersData) return [];
      const peers = JSON.parse(storedPeersData);
      return peers.filter(isValidStoredPeer);
    } catch (error) {
      log.error("Error parsing peers from local storage:", error);
      return [];
    }
  }

  private setPeersInLocalStorage(peers: LocalStoragePeerInfo[]): void {
    localStorage.setItem("waku:peers", JSON.stringify(peers));
  }
}

function isValidStoredPeer(peer: any): peer is LocalStoragePeerInfo {
  return (
    peer &&
    typeof peer === "object" &&
    typeof peer.id === "string" &&
    typeof peer.address === "string"
  );
}

export function wakuLocalStorageDiscovery(): (
  components: Libp2pComponents,
  options?: LocalStorageDiscoveryOptions
) => LocalStorageDiscovery {
  return (
    components: Libp2pComponents,
    options?: LocalStorageDiscoveryOptions
  ) => new LocalStorageDiscovery(components, options);
}

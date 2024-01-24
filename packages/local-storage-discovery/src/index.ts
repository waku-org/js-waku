import { TypedEventEmitter } from "@libp2p/interface";
import type {
  PeerDiscovery,
  PeerDiscoveryEvents,
  PeerInfo,
  PeerUpdate,
  Startable
} from "@libp2p/interface";
import { createFromJSON } from "@libp2p/peer-id-factory";
import { multiaddr } from "@multiformats/multiaddr";
import { Libp2pComponents, Tags } from "@waku/interfaces";
import { Logger } from "@waku/utils";

const log = new Logger("peer-exchange-discovery");

type LocalStoragePeerInfo = {
  id: string;
  address: string;
};

type LocalStorageDiscoveryOptions = {
  tagValue?: number;
  tagTTL?: number;
};

export const DEFAULT_PEER_EXCHANGE_TAG_NAME = Tags.PEER_EXCHANGE;
const DEFAULT_PEER_EXCHANGE_TAG_VALUE = 50;
const DEFAULT_PEER_EXCHANGE_TAG_TTL = 100_000_000;

class LocalStorageDiscovery
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

    // only listen to healthy connected peers that have identified themselves
    this.components.events.addEventListener("peer:update", this.handleNewPeers);

    // get all peers from local storage
    const localStoragePeers = this.getPeersFromLocalStorage();

    //  update the tags of the peers in the peer store & dispatch them
    for (const { id: idStr, address } of localStoragePeers) {
      const peerId = await createFromJSON({
        id: idStr
      });

      await this.components.peerStore.save(peerId, {
        tags: {
          [DEFAULT_PEER_EXCHANGE_TAG_NAME]: {
            value: this.options?.tagValue ?? DEFAULT_PEER_EXCHANGE_TAG_VALUE,
            ttl: this.options?.tagTTL ?? DEFAULT_PEER_EXCHANGE_TAG_TTL
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

    // Extract the websocket ma
    const websocketMultiaddr = peer.addresses.find((addr) =>
      addr.toString().includes("ws" || "wss")
    );
    if (!websocketMultiaddr) return;

    // Retrieve peers from local storage
    const storedPeersData = localStorage.getItem("waku:peers");
    const localStoragePeers = (
      storedPeersData ? JSON.parse(storedPeersData) : []
    ) as LocalStoragePeerInfo[];

    // Find if the peer already exists
    const existingPeerIndex = localStoragePeers.findIndex(
      (_peer) => _peer.id === peer.id.toString()
    );

    if (existingPeerIndex >= 0) {
      // Update existing peer's address
      localStoragePeers[existingPeerIndex].address =
        websocketMultiaddr.toString();
    } else {
      // Add new peer
      localStoragePeers.push({
        id: peer.id.toString(),
        address: websocketMultiaddr.toString()
      });
    }

    this.setPeersInLocalStorage(localStoragePeers);
  };

  private getPeersFromLocalStorage(): LocalStoragePeerInfo[] {
    const storedPeersData = localStorage.getItem("waku:peers");
    const localStoragePeers = (
      storedPeersData ? JSON.parse(storedPeersData) : []
    ) as LocalStoragePeerInfo[];
    return localStoragePeers;
  }

  private setPeersInLocalStorage(peers: LocalStoragePeerInfo[]): void {
    localStorage.setItem("waku:peers", JSON.stringify(peers));
  }
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

import type { AddressManager } from "@libp2p/interface-address-manager";
import type {
  ConnectionGater,
  ConnectionProtector,
} from "@libp2p/interface-connection";
import type {
  ConnectionManager,
  Dialer,
} from "@libp2p/interface-connection-manager";
import type { ContentRouting } from "@libp2p/interface-content-routing";
import type { DualDHT } from "@libp2p/interface-dht";
import type { Metrics } from "@libp2p/interface-metrics";
import type { PeerId } from "@libp2p/interface-peer-id";
import type { PeerRouting } from "@libp2p/interface-peer-routing";
import type { PeerStore } from "@libp2p/interface-peer-store";
import type { PubSub } from "@libp2p/interface-pubsub";
import type { Registrar } from "@libp2p/interface-registrar";
import type { TransportManager, Upgrader } from "@libp2p/interface-transport";
import type { Datastore } from "interface-datastore";

// TODO: Get libp2p to export this.
export interface Libp2pComponents {
  peerId: PeerId;
  addressManager: AddressManager;
  peerStore: PeerStore;
  upgrader: Upgrader;
  registrar: Registrar;
  connectionManager: ConnectionManager;
  transportManager: TransportManager;
  connectionGater: ConnectionGater;
  contentRouting: ContentRouting;
  peerRouting: PeerRouting;
  datastore: Datastore;
  connectionProtector?: ConnectionProtector;
  dialer: Dialer;
  metrics?: Metrics;
  dht?: DualDHT;
  pubsub?: PubSub;
}

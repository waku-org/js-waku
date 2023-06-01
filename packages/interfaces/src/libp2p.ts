import { GossipSub } from "@chainsafe/libp2p-gossipsub";
import type { AddressManager } from "@libp2p/interface-address-manager";
import type { ConnectionProtector } from "@libp2p/interface-connection";
import type { ConnectionGater } from "@libp2p/interface-connection-gater";
import type { ConnectionManager } from "@libp2p/interface-connection-manager";
import type { ContentRouting } from "@libp2p/interface-content-routing";
import type { Libp2p as BaseLibp2p } from "@libp2p/interface-libp2p";
import type { Libp2pEvents } from "@libp2p/interface-libp2p";
import type { Metrics } from "@libp2p/interface-metrics";
import type { PeerId } from "@libp2p/interface-peer-id";
import type { PeerRouting } from "@libp2p/interface-peer-routing";
import type { PeerStore } from "@libp2p/interface-peer-store";
import type { Registrar } from "@libp2p/interface-registrar";
import type { TransportManager, Upgrader } from "@libp2p/interface-transport";
import type { EventEmitter } from "@libp2p/interfaces/events";
import type { Startable } from "@libp2p/interfaces/startable";
import type { Datastore } from "interface-datastore";
import type { Libp2pOptions as BaseLibp2pOptions } from "libp2p";
import { identifyService } from "libp2p/identify";
import type { PingService } from "libp2p/ping";

export type Services = {
  ping: PingService;
  identify: typeof identifyService;
  pubsub?: GossipSub;
};

export type Libp2pOptions = BaseLibp2pOptions<Services>;
export type Libp2p = BaseLibp2p<Services>;

// TODO: Get libp2p to export this.

export interface Libp2pComponents extends Record<string, any>, Startable {
  peerId: PeerId;
  events: EventEmitter<Libp2pEvents>;
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
  metrics?: Metrics;
}

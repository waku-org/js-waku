import { isPeerId } from "@libp2p/interface";
import type { Peer, PeerId, Stream } from "@libp2p/interface";
import { multiaddr, Multiaddr, MultiaddrInput } from "@multiformats/multiaddr";
import { ConnectionManager, StoreCodec } from "@waku/core";
import type {
  CreateNodeOptions,
  IFilter,
  ILightPush,
  IRelay,
  IStore,
  IWaku,
  Libp2p,
  PubsubTopic
} from "@waku/interfaces";
import { Protocols } from "@waku/interfaces";
import { Logger } from "@waku/utils";

import { Filter } from "../filter/index.js";
import { HealthIndicator } from "../health_indicator/index.js";
import { LightPush } from "../light_push/index.js";
import { PeerManager } from "../peer_manager/index.js";
import { Store } from "../store/index.js";

import { waitForRemotePeer } from "./wait_for_remote_peer.js";

const log = new Logger("waku");

type ProtocolsEnabled = {
  filter?: boolean;
  lightpush?: boolean;
  store?: boolean;
};

export class WakuNode implements IWaku {
  public libp2p: Libp2p;
  public relay?: IRelay;
  public store?: IStore;
  public filter?: IFilter;
  public lightPush?: ILightPush;
  public connectionManager: ConnectionManager;
  public health: HealthIndicator;

  // needed to create a lock for async operations
  private _nodeStateLock = false;
  private _nodeStarted = false;

  private readonly peerManager: PeerManager;

  public constructor(
    public readonly pubsubTopics: PubsubTopic[],
    options: CreateNodeOptions,
    libp2p: Libp2p,
    protocolsEnabled: ProtocolsEnabled,
    relay?: IRelay
  ) {
    this.relay = relay;
    this.libp2p = libp2p;

    protocolsEnabled = {
      filter: false,
      lightpush: false,
      store: false,
      ...protocolsEnabled
    };

    const peerId = this.libp2p.peerId.toString();

    this.connectionManager = new ConnectionManager({
      libp2p,
      relay: this.relay,
      pubsubTopics: this.pubsubTopics,
      config: options?.connectionManager
    });

    this.peerManager = new PeerManager({
      libp2p,
      config: {
        numPeersToUse: options.numPeersToUse
      }
    });

    this.health = new HealthIndicator({ libp2p });

    if (protocolsEnabled.store) {
      if (options.store?.peer) {
        this.connectionManager
          .rawDialPeerWithProtocols(options.store.peer, [StoreCodec])
          .catch((e) => {
            log.error("Failed to dial store peer", e);
          });
      }

      this.store = new Store({
        libp2p,
        connectionManager: this.connectionManager,
        peerManager: this.peerManager,
        options: {
          peer: options.store?.peer
        }
      });
    }

    if (protocolsEnabled.lightpush) {
      this.lightPush = new LightPush({
        libp2p,
        peerManager: this.peerManager,
        connectionManager: this.connectionManager,
        options: options?.lightPush
      });
    }

    if (protocolsEnabled.filter) {
      this.filter = new Filter({
        libp2p,
        connectionManager: this.connectionManager,
        peerManager: this.peerManager,
        lightPush: this.lightPush,
        options: options.filter
      });
    }

    log.info(
      "Waku node created",
      peerId,
      `relay: ${!!this.relay}, store: ${!!this.store}, light push: ${!!this
        .lightPush}, filter: ${!!this.filter}`
    );
  }

  public get peerId(): PeerId {
    return this.libp2p.peerId;
  }

  public get protocols(): string[] {
    return this.libp2p.getProtocols();
  }

  public async dial(
    peer: PeerId | MultiaddrInput,
    protocols?: Protocols[]
  ): Promise<Stream> {
    const _protocols = protocols ?? [];

    if (typeof protocols === "undefined") {
      this.relay && _protocols.push(Protocols.Relay);
      this.store && _protocols.push(Protocols.Store);
      this.filter && _protocols.push(Protocols.Filter);
      this.lightPush && _protocols.push(Protocols.LightPush);
    }

    const codecs: string[] = [];
    if (_protocols.includes(Protocols.Relay)) {
      if (this.relay) {
        this.relay.gossipSub.multicodecs.forEach((codec: string) =>
          codecs.push(codec)
        );
      } else {
        log.error(
          "Relay codec not included in dial codec: protocol not mounted locally"
        );
      }
    }
    if (_protocols.includes(Protocols.Store)) {
      if (this.store) {
        codecs.push(this.store.protocol.multicodec);
      } else {
        log.error(
          "Store codec not included in dial codec: protocol not mounted locally"
        );
      }
    }
    if (_protocols.includes(Protocols.LightPush)) {
      if (this.lightPush) {
        codecs.push(this.lightPush.protocol.multicodec);
      } else {
        log.error(
          "Light Push codec not included in dial codec: protocol not mounted locally"
        );
      }
    }
    if (_protocols.includes(Protocols.Filter)) {
      if (this.filter) {
        codecs.push(this.filter.protocol.multicodec);
      } else {
        log.error(
          "Filter codec not included in dial codec: protocol not mounted locally"
        );
      }
    }

    const peerId = this.mapToPeerIdOrMultiaddr(peer);
    log.info(`Dialing to ${peerId.toString()} with protocols ${_protocols}`);
    return await this.connectionManager.rawDialPeerWithProtocols(peer, codecs);
  }

  public async start(): Promise<void> {
    if (this._nodeStateLock || this.isStarted()) return;

    this._nodeStateLock = true;

    await this.libp2p.start();
    this.peerManager.start();
    this.health.start();
    this.lightPush?.start();

    this._nodeStateLock = false;
    this._nodeStarted = true;
  }

  public async stop(): Promise<void> {
    if (this._nodeStateLock || !this.isStarted()) return;

    this._nodeStateLock = true;

    this.lightPush?.stop();
    this.health.stop();
    this.peerManager.stop();
    this.connectionManager.stop();
    await this.libp2p.stop();

    this._nodeStateLock = false;
    this._nodeStarted = false;
  }

  public async getConnectedPeers(): Promise<Peer[]> {
    return this.connectionManager.getConnectedPeers();
  }

  public async waitForPeers(
    protocols?: Protocols[],
    timeoutMs?: number
  ): Promise<void> {
    return waitForRemotePeer(this, protocols, timeoutMs);
  }

  public isStarted(): boolean {
    return this._nodeStarted && this.libp2p.status === "started";
  }

  public isConnected(): boolean {
    return this.connectionManager.isConnected();
  }

  private mapToPeerIdOrMultiaddr(
    peerId: PeerId | MultiaddrInput
  ): PeerId | Multiaddr {
    return isPeerId(peerId) ? peerId : multiaddr(peerId);
  }
}

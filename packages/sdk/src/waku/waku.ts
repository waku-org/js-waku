import {
  type Peer,
  type PeerId,
  type Stream,
  TypedEventEmitter
} from "@libp2p/interface";
import type { MultiaddrInput } from "@multiformats/multiaddr";
import { ConnectionManager, createDecoder, createEncoder } from "@waku/core";
import {
  ContentTopic,
  CreateDecoderParams,
  CreateEncoderParams,
  CreateNodeOptions,
  IDecodedMessage,
  IDecoder,
  IEncoder,
  IFilter,
  ILightPush,
  IMessageEmitter,
  IRelay,
  IRoutingInfo,
  IStore,
  IWaku,
  IWakuEventEmitter,
  Libp2p,
  NetworkConfig
} from "@waku/interfaces";
import {
  DefaultNetworkConfig,
  HealthStatus,
  Protocols
} from "@waku/interfaces";
import { createRoutingInfo, Logger, pushOrInitMapSet } from "@waku/utils";

import { Filter } from "../filter/index.js";
import { HealthIndicator } from "../health_indicator/index.js";
import { LightPush } from "../light_push/index.js";
import { PeerManager } from "../peer_manager/index.js";
import { Store } from "../store/index.js";

import { waitForRemotePeer } from "./wait_for_remote_peer.js";

const log = new Logger("sdk:waku");

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

  public readonly events: IWakuEventEmitter = new TypedEventEmitter();
  public readonly messageEmitter: IMessageEmitter = new TypedEventEmitter();

  private readonly networkConfig: NetworkConfig;

  // needed to create a lock for async operations
  private _nodeStateLock = false;
  private _nodeStarted = false;

  private readonly connectionManager: ConnectionManager;
  private readonly peerManager: PeerManager;
  private readonly healthIndicator: HealthIndicator;

  public constructor(
    options: CreateNodeOptions,
    libp2p: Libp2p,
    protocolsEnabled: ProtocolsEnabled,
    relay?: IRelay
  ) {
    this.relay = relay;
    this.libp2p = libp2p;
    this.networkConfig = options.networkConfig || DefaultNetworkConfig;

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
      events: this.events,
      networkConfig: this.networkConfig,
      config: options?.connectionManager
    });

    this.peerManager = new PeerManager({
      libp2p,
      config: {
        numPeersToUse: options.numPeersToUse
      },
      connectionManager: this.connectionManager
    });

    this.healthIndicator = new HealthIndicator({ libp2p, events: this.events });

    if (protocolsEnabled.store) {
      this.store = new Store({
        libp2p,
        peerManager: this.peerManager,
        options: options?.store
      });
    }

    if (protocolsEnabled.lightpush) {
      this.lightPush = new LightPush({
        libp2p,
        peerManager: this.peerManager,
        options: options?.lightPush
      });
    }

    if (protocolsEnabled.filter) {
      this.filter = new Filter({
        libp2p,
        peerManager: this.peerManager,
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

  public async subscribe(contentTopics: ContentTopic[]): Promise<void> {
    // Group content topics via routing info in case they spread across several shards
    const ctToRouting: Map<IRoutingInfo, Set<ContentTopic>> = new Map();
    for (const contentTopic of contentTopics) {
      const routingInfo = this.createRoutingInfo(contentTopic);
      pushOrInitMapSet(ctToRouting, routingInfo, contentTopic);
    }

    const promises = [];
    if (this.filter) {
      for (const [routingInfo, contentTopics] of ctToRouting) {
        // TODO: Returned bool from subscribe should be used
        promises.push(
          this.filter.subscribe(
            Array.from(contentTopics),
            routingInfo,
            this.emitIncomingMessages.bind(this, Array.from(contentTopics))
          )
        );
      }

      await Promise.all(promises);
      return;
    }

    if (this.relay) {
      throw "not implemented";
    }
    throw "no subscribe protocol available";
  }

  public get peerId(): PeerId {
    return this.libp2p.peerId;
  }

  public get protocols(): string[] {
    return this.libp2p.getProtocols();
  }

  public get health(): HealthStatus {
    return this.healthIndicator.toValue();
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
        codecs.push(this.store.multicodec);
      } else {
        log.error(
          "Store codec not included in dial codec: protocol not mounted locally"
        );
      }
    }
    if (_protocols.includes(Protocols.LightPush)) {
      if (this.lightPush) {
        codecs.push(...this.lightPush.multicodec);
      } else {
        log.error(
          "Light Push codec not included in dial codec: protocol not mounted locally"
        );
      }
    }
    if (_protocols.includes(Protocols.Filter)) {
      if (this.filter) {
        codecs.push(this.filter.multicodec);
      } else {
        log.error(
          "Filter codec not included in dial codec: protocol not mounted locally"
        );
      }
    }

    log.info(`Dialing to ${peer?.toString()} with protocols ${_protocols}`);

    return await this.connectionManager.dial(peer, codecs);
  }

  public async hangUp(peer: PeerId | MultiaddrInput): Promise<boolean> {
    log.info(`Hanging up peer:${peer?.toString()}.`);

    return this.connectionManager.hangUp(peer);
  }

  public async start(): Promise<void> {
    if (this._nodeStateLock || this.isStarted()) return;

    this._nodeStateLock = true;

    await this.libp2p.start();
    await this.filter?.start();
    this.connectionManager.start();
    this.peerManager.start();
    this.healthIndicator.start();
    this.lightPush?.start();

    this._nodeStateLock = false;
    this._nodeStarted = true;
  }

  public async stop(): Promise<void> {
    if (this._nodeStateLock || !this.isStarted()) return;

    this._nodeStateLock = true;

    this.lightPush?.stop();
    await this.filter?.stop();
    this.healthIndicator.stop();
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

  public createDecoder(params: CreateDecoderParams): IDecoder<IDecodedMessage> {
    const routingInfo = this.createRoutingInfo(
      params.contentTopic,
      params.shardId
    );
    return createDecoder(params.contentTopic, routingInfo);
  }

  public createEncoder(params: CreateEncoderParams): IEncoder {
    const routingInfo = this.createRoutingInfo(
      params.contentTopic,
      params.shardId
    );

    return createEncoder({
      contentTopic: params.contentTopic,
      ephemeral: params.ephemeral,
      routingInfo: routingInfo
    });
  }

  private createRoutingInfo(
    contentTopic?: string,
    shardId?: number
  ): IRoutingInfo {
    return createRoutingInfo(this.networkConfig, { contentTopic, shardId });
  }

  private emitIncomingMessages(
    contentTopics: ContentTopic[],
    message: {
      contentTopic: ContentTopic;
      payload: Uint8Array;
    }
  ): void {
    if (contentTopics.includes(message.contentTopic)) {
      this.messageEmitter.dispatchEvent(
        new CustomEvent<Uint8Array>(message.contentTopic, {
          detail: message.payload
        })
      );
    }
  }
}

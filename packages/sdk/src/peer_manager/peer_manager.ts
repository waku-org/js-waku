import {
  IdentifyResult,
  Peer,
  PeerId,
  TypedEventEmitter
} from "@libp2p/interface";
import {
  ConnectionManager,
  FilterCodecs,
  LightPushCodec,
  StoreCodec
} from "@waku/core";
import { Libp2p, Protocols } from "@waku/interfaces";
import { Logger } from "@waku/utils";

const log = new Logger("peer-manager");

const DEFAULT_NUM_PEERS_TO_USE = 2;

type PeerManagerConfig = {
  numPeersToUse?: number;
};

type PeerManagerParams = {
  libp2p: Libp2p;
  config?: PeerManagerConfig;
  connectionManager: ConnectionManager;
};

type GetPeersParams = {
  protocol: Protocols;
  pubsubTopic: string;
};

export enum PeerManagerEventNames {
  Connect = "filter:connect",
  Disconnect = "filter:disconnect"
}

interface IPeerManagerEvents {
  /**
   * Notifies about Filter peer being connected.
   */
  [PeerManagerEventNames.Connect]: CustomEvent<PeerId>;

  /**
   * Notifies about Filter peer being disconnected.
   */
  [PeerManagerEventNames.Disconnect]: CustomEvent<PeerId>;
}

type Libp2pEventHandler<T> = (e: CustomEvent<T>) => void;

/**
 * @description
 * PeerManager is responsible for:
 * - finding available peers based on shard / protocols;
 * - notifying when peers for a specific protocol are connected;
 * - notifying when peers for a specific protocol are disconnected;
 */
export class PeerManager {
  public readonly events = new TypedEventEmitter<IPeerManagerEvents>();

  private readonly numPeersToUse: number;

  private readonly libp2p: Libp2p;
  private readonly connectionManager: ConnectionManager;

  private readonly lockedPeers = new Set<string>();
  private readonly unlockedPeers = new Map<string, number>();

  public constructor(params: PeerManagerParams) {
    this.onConnected = this.onConnected.bind(this);
    this.onDisconnected = this.onDisconnected.bind(this);

    this.numPeersToUse =
      params?.config?.numPeersToUse || DEFAULT_NUM_PEERS_TO_USE;

    this.libp2p = params.libp2p;
    this.connectionManager = params.connectionManager;
  }

  public start(): void {
    this.libp2p.addEventListener(
      "peer:identify",
      this.onConnected as Libp2pEventHandler<IdentifyResult>
    );
    this.libp2p.addEventListener(
      "peer:disconnect",
      this.onDisconnected as Libp2pEventHandler<PeerId>
    );
  }

  public stop(): void {
    this.libp2p.removeEventListener(
      "peer:identify",
      this.onConnected as Libp2pEventHandler<IdentifyResult>
    );
    this.libp2p.removeEventListener(
      "peer:disconnect",
      this.onDisconnected as Libp2pEventHandler<PeerId>
    );
  }

  public async getPeers(params: GetPeersParams): Promise<PeerId[]> {
    log.info(
      `Getting peers for protocol: ${params.protocol}, pubsubTopic: ${params.pubsubTopic}`
    );

    const connectedPeers = await this.connectionManager.getConnectedPeers();
    log.info(`Found ${connectedPeers.length} connected peers`);

    let results: Peer[] = [];

    for (const peer of connectedPeers) {
      const hasProtocol = this.hasPeerProtocol(peer, params.protocol);
      const hasSamePubsub = await this.connectionManager.isPeerOnTopic(
        peer.id,
        params.pubsubTopic
      );
      const isPeerAvailableForUse = this.isPeerAvailableForUse(peer.id);

      if (hasProtocol && hasSamePubsub && isPeerAvailableForUse) {
        results.push(peer);
        log.info(`Peer ${peer.id} qualifies for protocol ${params.protocol}`);
      }
    }

    const lockedPeers = results.filter((p) => this.isPeerLocked(p.id));
    log.info(
      `Found ${lockedPeers.length} locked peers out of ${results.length} qualifying peers`
    );

    if (lockedPeers.length >= this.numPeersToUse) {
      const selectedPeers = lockedPeers
        .slice(0, this.numPeersToUse)
        .map((p) => p.id);

      log.info(
        `Using ${selectedPeers.length} locked peers: ${selectedPeers.map((p) => p.toString())}`
      );

      return selectedPeers;
    }

    const notLockedPeers = results.filter((p) => !this.isPeerLocked(p.id));
    log.info(
      `Found ${notLockedPeers.length} unlocked peers, need ${this.numPeersToUse - lockedPeers.length} more`
    );

    results = [...lockedPeers, ...notLockedPeers]
      .slice(0, this.numPeersToUse)
      .map((p) => {
        this.lockPeer(p.id);
        return p;
      });

    const finalPeers = results.map((p) => p.id);

    log.info(
      `Selected ${finalPeers.length} peers: ${finalPeers.map((p) => p.toString())}`
    );
    return finalPeers;
  }

  public async renewPeer(id: PeerId, params: GetPeersParams): Promise<void> {
    log.info(
      `Renewing peer ${id} for protocol: ${params.protocol}, pubsubTopic: ${params.pubsubTopic}`
    );

    const connectedPeers = await this.connectionManager.getConnectedPeers();
    const renewedPeer = connectedPeers.find((p) => p.id.equals(id));

    if (!renewedPeer) {
      log.warn(`Cannot renew peer:${id}, no connection to the peer.`);
      return;
    }

    log.info(
      `Found peer ${id} in connected peers, unlocking and getting new peers`
    );
    this.unlockPeer(renewedPeer.id);
    await this.getPeers(params);
  }

  public async isPeerOnPubsub(
    id: PeerId,
    pubsubTopic: string
  ): Promise<boolean> {
    return this.connectionManager.isPeerOnTopic(id, pubsubTopic);
  }

  private async onConnected(event: CustomEvent<IdentifyResult>): Promise<void> {
    const result = event.detail;
    const isFilterPeer = result.protocols.includes(
      this.matchProtocolToCodec(Protocols.Filter)
    );

    if (isFilterPeer) {
      this.dispatchFilterPeerConnect(result.peerId);
    }
  }

  private async onDisconnected(event: CustomEvent<PeerId>): Promise<void> {
    const peerId = event.detail;

    try {
      // we need to read from peerStore as peer is already disconnected
      const peer = await this.libp2p.peerStore.get(peerId);
      const isFilterPeer = this.hasPeerProtocol(peer, Protocols.Filter);

      if (isFilterPeer) {
        this.dispatchFilterPeerDisconnect(peer.id);
      }
    } catch (error) {
      log.error(`Failed to dispatch Filter disconnect event:${error}`);
    }
  }

  private hasPeerProtocol(peer: Peer, protocol: Protocols): boolean {
    return peer.protocols.includes(this.matchProtocolToCodec(protocol));
  }

  private lockPeer(id: PeerId): void {
    log.info(`Locking peer ${id}`);
    this.lockedPeers.add(id.toString());
    this.unlockedPeers.delete(id.toString());
  }

  private isPeerLocked(id: PeerId): boolean {
    return this.lockedPeers.has(id.toString());
  }

  private unlockPeer(id: PeerId): void {
    log.info(`Unlocking peer ${id}`);
    this.lockedPeers.delete(id.toString());
    this.unlockedPeers.set(id.toString(), Date.now());
  }

  private isPeerAvailableForUse(id: PeerId): boolean {
    const value = this.unlockedPeers.get(id.toString());

    if (!value) {
      return true;
    }

    const wasUnlocked = new Date(value).getTime();
    return Date.now() - wasUnlocked >= 10_000 ? true : false;
  }

  private dispatchFilterPeerConnect(id: PeerId): void {
    this.events.dispatchEvent(
      new CustomEvent(PeerManagerEventNames.Connect, { detail: id })
    );
  }

  private dispatchFilterPeerDisconnect(id: PeerId): void {
    this.events.dispatchEvent(
      new CustomEvent(PeerManagerEventNames.Disconnect, { detail: id })
    );
  }

  private matchProtocolToCodec(protocol: Protocols): string {
    const protocolToCodec = {
      [Protocols.Filter]: FilterCodecs.SUBSCRIBE,
      [Protocols.LightPush]: LightPushCodec,
      [Protocols.Store]: StoreCodec,
      [Protocols.Relay]: ""
    };

    return protocolToCodec[protocol];
  }
}

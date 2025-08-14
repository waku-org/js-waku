import { TypedEventEmitter } from "@libp2p/interface";
import { peerDiscoverySymbol as symbol } from "@libp2p/interface";
import type {
  IdentifyResult,
  PeerDiscovery,
  PeerDiscoveryEvents,
  PeerId,
  PeerInfo
} from "@libp2p/interface";
import {
  type IPeerExchange,
  type Libp2pComponents,
  type Libp2pEventHandler
} from "@waku/interfaces";
import { encodeRelayShard, Logger } from "@waku/utils";

import {
  DEFAULT_PEER_EXCHANGE_REQUEST_NODES,
  DEFAULT_PEER_EXCHANGE_TAG_NAME,
  DEFAULT_PEER_EXCHANGE_TAG_TTL,
  DEFAULT_PEER_EXCHANGE_TAG_VALUE,
  PeerExchangeCodec
} from "./constants.js";
import { PeerExchange } from "./peer_exchange.js";

const log = new Logger("peer-exchange-discovery");

interface PeerExchangeDiscoveryOptions {
  /**
   * Peer TTL in milliseconds.
   * This is the time after which a peer will be considered stale and will be re-queried via peer exchange.
   *
   * @default 30_000
   */
  TTL: number;
}

export class PeerExchangeDiscovery
  extends TypedEventEmitter<PeerDiscoveryEvents>
  implements PeerDiscovery
{
  private readonly components: Libp2pComponents;
  private readonly peerExchange: IPeerExchange;
  private readonly options: PeerExchangeDiscoveryOptions;

  private isStarted: boolean = false;
  private queryingPeers: Set<string> = new Set();

  private peerExpirationRecords: Map<string, number> = new Map();
  private continuousDiscoveryInterval: NodeJS.Timeout | null = null;

  public constructor(
    components: Libp2pComponents,
    options: Partial<PeerExchangeDiscoveryOptions> = {}
  ) {
    super();

    this.components = components;
    this.peerExchange = new PeerExchange(components);
    this.options = {
      ...options,
      TTL: options.TTL ?? DEFAULT_PEER_EXCHANGE_TAG_TTL
    };

    this.handleDiscoveredPeer = this.handleDiscoveredPeer.bind(this);
  }

  /**
   * Start Peer Exchange.
   * Subscribe to "peer:identify" events and handle them.
   */
  public start(): void {
    if (this.isStarted) {
      return;
    }

    log.info("Starting peer exchange node discovery, discovering peers");
    this.isStarted = true;

    this.components.events.addEventListener(
      "peer:identify",
      this.handleDiscoveredPeer as Libp2pEventHandler<IdentifyResult>
    );

    this.continuousDiscoveryInterval = setInterval(() => {
      void this.handlePeriodicDiscovery();
    }, this.options.TTL);
  }

  /**
   * Stop Peer Exchange.
   * Unsubscribe from "peer:identify" events.
   */
  public stop(): void {
    if (!this.isStarted) {
      return;
    }

    log.info("Stopping peer exchange node discovery");

    this.isStarted = false;
    this.queryingPeers.clear();
    this.peerExpirationRecords.clear();

    if (this.continuousDiscoveryInterval) {
      clearInterval(this.continuousDiscoveryInterval);
    }

    this.components.events.removeEventListener(
      "peer:identify",
      this.handleDiscoveredPeer as Libp2pEventHandler<IdentifyResult>
    );
  }

  public get [symbol](): true {
    return true;
  }

  public get [Symbol.toStringTag](): string {
    return "@waku/peer-exchange";
  }

  private async handleDiscoveredPeer(
    event: CustomEvent<IdentifyResult>
  ): Promise<void> {
    void this.runQuery(event.detail.peerId, event.detail.protocols);
  }

  private async handlePeriodicDiscovery(): Promise<void> {
    const connections = this.components.connectionManager.getConnections();

    await Promise.all(
      connections.map(async (connection) => {
        try {
          const peerIdStr = connection.remotePeer.toString();
          const shouldQuery = this.peerExpirationRecords.has(peerIdStr)
            ? this.peerExpirationRecords.get(peerIdStr)! <= Date.now()
            : true;

          if (!shouldQuery) {
            return null;
          }

          const peer = await this.components.peerStore.get(
            connection.remotePeer
          );

          return this.runQuery(connection.remotePeer, peer.protocols);
        } catch (error) {
          log.warn("Error getting peer info", error);
          return null;
        }
      })
    );
  }

  private async runQuery(peerId: PeerId, protocols: string[]): Promise<void> {
    if (
      !protocols.includes(PeerExchangeCodec) ||
      this.queryingPeers.has(peerId.toString())
    ) {
      log.info(
        `Skipping peer ${peerId} as it is already querying or does not support peer exchange`
      );
      return;
    }

    try {
      this.queryingPeers.add(peerId.toString());
      await this.query(peerId);
    } catch (error) {
      log.error("Error querying peer", error);
    }

    this.peerExpirationRecords.set(
      peerId.toString(),
      Date.now() + this.options.TTL
    );

    this.queryingPeers.delete(peerId.toString());
  }

  private async query(peerId: PeerId): Promise<void> {
    const peerIdStr = peerId.toString();
    log.info(`Querying peer exchange for ${peerIdStr}`);

    const { error, peerInfos } = await this.peerExchange.query({
      numPeers: DEFAULT_PEER_EXCHANGE_REQUEST_NODES,
      peerId
    });

    if (error) {
      log.error(`Peer exchange query to ${peerIdStr} failed`, error);
      return;
    }

    for (const { ENR } of peerInfos) {
      if (!ENR) {
        log.warn(`No ENR in peerInfo object from ${peerIdStr}, skipping`);
        continue;
      }

      const { peerInfo, shardInfo } = ENR;

      if (!peerInfo) {
        log.warn(`No peerInfo in ENR from ${peerIdStr}, skipping`);
        continue;
      }

      const hasPrevShardInfo = await this.hasShardInfo(peerInfo.id);
      const metadata =
        !hasPrevShardInfo && shardInfo
          ? { metadata: { shardInfo: encodeRelayShard(shardInfo) } }
          : undefined;

      // merge is smart enough to overwrite only changed parts
      await this.components.peerStore.merge(peerInfo.id, {
        tags: {
          [DEFAULT_PEER_EXCHANGE_TAG_NAME]: {
            value: DEFAULT_PEER_EXCHANGE_TAG_VALUE
          }
        },
        ...metadata,
        ...(peerInfo.multiaddrs && {
          multiaddrs: peerInfo.multiaddrs
        })
      });

      log.info(`Discovered peer: ${peerInfo.id.toString()}`);

      this.dispatchEvent(
        new CustomEvent<PeerInfo>("peer", {
          detail: {
            id: peerInfo.id,
            multiaddrs: peerInfo.multiaddrs
          }
        })
      );
    }
  }

  private async hasShardInfo(peerId: PeerId): Promise<boolean> {
    try {
      const peer = await this.components.peerStore.get(peerId);

      if (!peer) {
        return false;
      }

      return peer.metadata.has("shardInfo");
    } catch (err) {
      log.warn(`Error getting shard info for ${peerId.toString()}`, err);
    }

    return false;
  }
}

export function wakuPeerExchangeDiscovery(
  options: Partial<PeerExchangeDiscoveryOptions> = {}
): (components: Libp2pComponents) => PeerExchangeDiscovery {
  return (components: Libp2pComponents) =>
    new PeerExchangeDiscovery(components, options);
}

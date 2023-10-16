import type { IdentifyResult } from "@libp2p/interface";
import { CustomEvent, EventEmitter } from "@libp2p/interface/events";
import type {
  PeerDiscovery,
  PeerDiscoveryEvents
} from "@libp2p/interface/peer-discovery";
import { peerDiscovery as symbol } from "@libp2p/interface/peer-discovery";
import type { PeerId } from "@libp2p/interface/peer-id";
import type { PeerInfo } from "@libp2p/interface/peer-info";
import { encodeRelayShard } from "@waku/enr";
import { Libp2pComponents, Tags } from "@waku/interfaces";
import debug from "debug";

import { PeerExchangeCodec, WakuPeerExchange } from "./waku_peer_exchange.js";

const log = debug("waku:peer-exchange-discovery");

const DEFAULT_PEER_EXCHANGE_REQUEST_NODES = 10;
const DEFAULT_PEER_EXCHANGE_QUERY_INTERVAL_MS = 10 * 1000;
const DEFAULT_MAX_RETRIES = 3;

export interface Options {
  /**
   * Tag a bootstrap peer with this name before "discovering" it (default: 'bootstrap')
   */
  tagName?: string;

  /**
   * The bootstrap peer tag will have this value (default: 50)
   */
  tagValue?: number;

  /**
   * Cause the bootstrap peer tag to be removed after this number of ms (default: 2 minutes)
   */
  tagTTL?: number;
  /**
   * The interval between queries to a peer (default: 10 seconds)
   * The interval will increase by a factor of an incrementing number (starting at 1)
   * until it reaches the maximum attempts before backoff
   */
  queryInterval?: number;
  /**
   * The number of attempts before the queries to a peer are aborted (default: 3)
   */
  maxRetries?: number;
}

export const DEFAULT_PEER_EXCHANGE_TAG_NAME = Tags.PEER_EXCHANGE;
const DEFAULT_PEER_EXCHANGE_TAG_VALUE = 50;
const DEFAULT_PEER_EXCHANGE_TAG_TTL = 100_000_000;

export class PeerExchangeDiscovery
  extends EventEmitter<PeerDiscoveryEvents>
  implements PeerDiscovery
{
  private readonly components: Libp2pComponents;
  private readonly peerExchange: WakuPeerExchange;
  private readonly options: Options;
  private isStarted: boolean;
  private queryingPeers: Set<string> = new Set();
  private queryAttempts: Map<string, number> = new Map();

  private readonly handleDiscoveredPeer = (
    event: CustomEvent<IdentifyResult>
  ): void => {
    const { protocols, peerId } = event.detail;

    if (
      !protocols.includes(PeerExchangeCodec) ||
      this.queryingPeers.has(peerId.toString())
    )
      return;

    this.queryingPeers.add(peerId.toString());
    this.startRecurringQueries(peerId).catch((error) =>
      log(`Error querying peer ${error}`)
    );
  };

  constructor(components: Libp2pComponents, options: Options = {}) {
    super();
    this.components = components;
    this.peerExchange = new WakuPeerExchange(components);
    this.options = options;
    this.isStarted = false;
  }

  /**
   * Start emitting events
   */
  start(): void {
    if (this.isStarted) {
      return;
    }

    log("Starting peer exchange node discovery, discovering peers");

    // might be better to use "peer:identify" or "peer:update"
    this.components.events.addEventListener(
      "peer:identify",
      this.handleDiscoveredPeer
    );
  }

  /**
   * Remove event listener
   */
  stop(): void {
    if (!this.isStarted) return;
    log("Stopping peer exchange node discovery");
    this.isStarted = false;
    this.queryingPeers.clear();
    this.components.events.removeEventListener(
      "peer:identify",
      this.handleDiscoveredPeer
    );
  }

  get [symbol](): true {
    return true;
  }

  get [Symbol.toStringTag](): string {
    return "@waku/peer-exchange";
  }

  private readonly startRecurringQueries = async (
    peerId: PeerId
  ): Promise<void> => {
    const peerIdStr = peerId.toString();
    const {
      queryInterval = DEFAULT_PEER_EXCHANGE_QUERY_INTERVAL_MS,
      maxRetries = DEFAULT_MAX_RETRIES
    } = this.options;

    log(
      `Querying peer: ${peerIdStr} (attempt ${
        this.queryAttempts.get(peerIdStr) ?? 1
      })`
    );

    await this.query(peerId);

    const currentAttempt = this.queryAttempts.get(peerIdStr) ?? 1;

    if (currentAttempt > maxRetries) {
      this.abortQueriesForPeer(peerIdStr);
      return;
    }

    setTimeout(() => {
      this.queryAttempts.set(peerIdStr, currentAttempt + 1);
      this.startRecurringQueries(peerId).catch((error) => {
        log(`Error in startRecurringQueries: ${error}`);
      });
    }, queryInterval * currentAttempt);
  };

  private async query(peerId: PeerId): Promise<void> {
    const peerInfos = await this.peerExchange.query({
      numPeers: DEFAULT_PEER_EXCHANGE_REQUEST_NODES,
      peerId
    });

    if (!peerInfos) {
      log("Peer exchange query failed, no peer info returned");
      return;
    }

    for (const _peerInfo of peerInfos) {
      const { ENR } = _peerInfo;
      if (!ENR) {
        log("No ENR in peerInfo object, skipping");
        continue;
      }

      const { peerId, peerInfo, shardInfo } = ENR;
      if (!peerId || !peerInfo) {
        continue;
      }

      const hasPeer = await this.components.peerStore.has(peerId);
      if (hasPeer) {
        continue;
      }

      // update the tags for the peer
      await this.components.peerStore.save(peerId, {
        tags: {
          [DEFAULT_PEER_EXCHANGE_TAG_NAME]: {
            value: this.options.tagValue ?? DEFAULT_PEER_EXCHANGE_TAG_VALUE,
            ttl: this.options.tagTTL ?? DEFAULT_PEER_EXCHANGE_TAG_TTL
          }
        },
        ...(shardInfo && {
          metadata: {
            shardInfo: encodeRelayShard(shardInfo)
          }
        })
      });

      log(`Discovered peer: ${peerId.toString()}`);

      this.dispatchEvent(
        new CustomEvent<PeerInfo>("peer", {
          detail: {
            id: peerId,
            protocols: [],
            multiaddrs: peerInfo.multiaddrs
          }
        })
      );
    }
  }

  private abortQueriesForPeer(peerIdStr: string): void {
    log(`Aborting queries for peer: ${peerIdStr}`);
    this.queryingPeers.delete(peerIdStr);
    this.queryAttempts.delete(peerIdStr);
  }
}

export function wakuPeerExchangeDiscovery(): (
  components: Libp2pComponents
) => PeerExchangeDiscovery {
  return (components: Libp2pComponents) =>
    new PeerExchangeDiscovery(components);
}

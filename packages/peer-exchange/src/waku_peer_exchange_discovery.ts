import {
  PeerDiscovery,
  PeerDiscoveryEvents,
  symbol,
} from "@libp2p/interface-peer-discovery";
import type { PeerId } from "@libp2p/interface-peer-id";
import { PeerInfo } from "@libp2p/interface-peer-info";
import { PeerProtocolsChangeData } from "@libp2p/interface-peer-store";
import { EventEmitter } from "@libp2p/interfaces/events";
import { PeerExchangeComponents } from "@waku/interfaces";
import debug from "debug";

import { PeerExchangeCodec, WakuPeerExchange } from "./waku_peer_exchange.js";

const log = debug("waku:peer-exchange-discovery");

const DEFAULT_PEER_EXCHANGE_REQUEST_NODES = 10;
const DEFAULT_PEER_EXCHANGE_INITIAL_QUERY_TIMEOUT_MS = 5 * 1000;
const DEFAULT_PEER_EXCHANGE_QUERY_INTERVAL_MS = 10 * 1000;
const DEFAULT_ATTEMPTS_BEFORE_BACKOFF = 3;

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
   * The initial timeout before querying a peer for the first time (default: 5 seconds)
   */
  initialQueryTimeout?: number;
  /**
   * The interval between queries to a peer (default: 10 seconds)
   * The interval will increase by a factor of an incrementing number (starting at 1)
   * until it reaches the maximum attempts before backoff
   */
  queryInterval?: number;
  /**
   * The number of attempts before the queries to a peer are backed off (default: 3)
   */
  attemptsBeforeBackOff?: number;
}

const DEFAULT_BOOTSTRAP_TAG_NAME = "peer-exchange";
const DEFAULT_BOOTSTRAP_TAG_VALUE = 50;
const DEFAULT_BOOTSTRAP_TAG_TTL = 120000;

export class PeerExchangeDiscovery
  extends EventEmitter<PeerDiscoveryEvents>
  implements PeerDiscovery
{
  private readonly components: PeerExchangeComponents;
  private readonly peerExchange: WakuPeerExchange;
  private readonly options: Options;
  private isStarted: boolean;
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private queryAttempts: Map<string, number> = new Map();

  private readonly eventHandler = async (
    event: CustomEvent<PeerProtocolsChangeData>
  ): Promise<void> => {
    const { protocols, peerId } = event.detail;
    if (
      !protocols.includes(PeerExchangeCodec) ||
      this.intervals.get(peerId.toString())
    )
      return;

    this.startRecurringQueries(
      peerId,
      this.options.initialQueryTimeout,
      this.options.attemptsBeforeBackOff,
      this.options.queryInterval
    ).catch((error) => log(`Error querying peer ${error}`));
  };

  constructor(components: PeerExchangeComponents, options: Options = {}) {
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

    this.components.peerStore.addEventListener(
      "change:protocols",
      this.eventHandler
    );
  }

  /**
   * Remove event listener
   */
  stop(): void {
    if (!this.isStarted) return;
    log("Stopping peer exchange node discovery");
    this.isStarted = false;
    this.intervals.forEach((interval) => clearInterval(interval));
    this.components.peerStore.removeEventListener(
      "change:protocols",
      this.eventHandler
    );
  }

  get [symbol](): true {
    return true;
  }

  get [Symbol.toStringTag](): string {
    return "@waku/peer-exchange";
  }

  private readonly startRecurringQueries = async (
    peerId: PeerId,
    firstQueryTimeout: number = DEFAULT_PEER_EXCHANGE_INITIAL_QUERY_TIMEOUT_MS,
    attemptsBeforeBackoff: number = DEFAULT_ATTEMPTS_BEFORE_BACKOFF,
    queryInterval: number = DEFAULT_PEER_EXCHANGE_QUERY_INTERVAL_MS
  ): Promise<void> => {
    const peerIdStr = peerId.toString();
    if (!this.queryAttempts.has(peerIdStr))
      this.queryAttempts.set(peerIdStr, 1);

    setTimeout(async () => {
      await this.query(peerId);
    }, firstQueryTimeout);

    const interval = setInterval(async () => {
      const currentAttempt = this.queryAttempts.get(peerIdStr) as number;
      if (currentAttempt > attemptsBeforeBackoff) {
        this.backOffPeer(peerIdStr, interval);
        return;
      }

      this.queryAttempts.set(peerIdStr, currentAttempt + 1);

      await this.query(peerId);
    }, queryInterval * (this.queryAttempts.get(peerIdStr) as number));

    this.intervals.set(peerIdStr, interval);
  };

  private query(peerId: PeerId): Promise<void> {
    return this.peerExchange.query(
      {
        numPeers: DEFAULT_PEER_EXCHANGE_REQUEST_NODES,
        peerId,
      },
      async (response) => {
        const { peerInfos } = response;

        for (const _peerInfo of peerInfos) {
          const { ENR } = _peerInfo;
          if (!ENR) {
            log("no ENR");
            continue;
          }

          const { peerId } = ENR;
          const multiaddrs = ENR.getFullMultiaddrs();

          if (!peerId) {
            log("no peerId");
            continue;
          }
          if (!multiaddrs || multiaddrs.length === 0) {
            log("no multiaddrs");
            continue;
          }

          // weird hack as peerStore.get() throws an error if peer is not in peerStore
          try {
            // check if peer is already in peerStore
            // continue if already exists
            await this.components.peerStore.get(peerId);
            continue;
          } catch (e) {
            // peer is not in peerStore and thus we proceed
          }

          const tags = (await this.components.peerStore.getTags(peerId)).map(
            ({ name }) => name
          );

          if (tags.includes(DEFAULT_BOOTSTRAP_TAG_NAME)) continue;

          await this.components.peerStore.tagPeer(
            peerId,
            DEFAULT_BOOTSTRAP_TAG_NAME,
            {
              value: this.options.tagValue ?? DEFAULT_BOOTSTRAP_TAG_VALUE,
              ttl: this.options.tagTTL ?? DEFAULT_BOOTSTRAP_TAG_TTL,
            }
          );

          this.dispatchEvent(
            new CustomEvent<PeerInfo>("peer", {
              detail: {
                id: peerId,
                multiaddrs,
                protocols: [],
              },
            })
          );
        }
      }
    );
  }

  private backOffPeer(peerIdStr: string, interval: NodeJS.Timer): void {
    log(`Backing off peer ${peerIdStr}`);
    clearInterval(interval);
    this.intervals.delete(peerIdStr);
    this.queryAttempts.delete(peerIdStr);
  }
}

export function wakuPeerExchangeDiscovery(): (
  components: PeerExchangeComponents
) => PeerExchangeDiscovery {
  return (components: PeerExchangeComponents) =>
    new PeerExchangeDiscovery(components);
}

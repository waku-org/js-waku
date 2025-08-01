import {
  PeerDiscovery,
  PeerDiscoveryEvents,
  TypedEventEmitter
} from "@libp2p/interface";
import { peerDiscoverySymbol as symbol } from "@libp2p/interface";
import type { PeerInfo } from "@libp2p/interface";
import type {
  DiscoveryTrigger,
  DnsDiscOptions,
  DnsDiscoveryComponents,
  IEnr
} from "@waku/interfaces";
import { DNS_DISCOVERY_TAG } from "@waku/interfaces";
import { encodeRelayShard, Logger } from "@waku/utils";

import {
  DEFAULT_BOOTSTRAP_TAG_NAME,
  DEFAULT_BOOTSTRAP_TAG_TTL,
  DEFAULT_BOOTSTRAP_TAG_VALUE
} from "./constants.js";
import { DnsNodeDiscovery } from "./dns.js";

const log = new Logger("peer-discovery-dns");

/**
 * Parse options and expose function to return bootstrap peer addresses.
 */
export class PeerDiscoveryDns
  extends TypedEventEmitter<PeerDiscoveryEvents>
  implements PeerDiscovery, DiscoveryTrigger
{
  private nextPeer: (() => AsyncGenerator<IEnr>) | undefined;
  private _started: boolean;
  private _components: DnsDiscoveryComponents;
  private readonly _options: DnsDiscOptions;

  public constructor(
    components: DnsDiscoveryComponents,
    options: DnsDiscOptions
  ) {
    super();
    this._started = false;
    this._components = components;
    this._options = options;

    const { enrUrls } = options;
    log.info("Use following EIP-1459 ENR Tree URLs: ", enrUrls);
  }

  /**
   * Start discovery process
   */
  public async start(): Promise<void> {
    log.info("Starting peer discovery via dns");

    this._started = true;
    await this.findPeers();
  }

  public async findPeers(): Promise<void> {
    if (!this.nextPeer) {
      let { enrUrls } = this._options;
      if (!Array.isArray(enrUrls)) enrUrls = [enrUrls];

      const dns = await DnsNodeDiscovery.dnsOverHttp();

      this.nextPeer = dns.getNextPeer.bind(dns, enrUrls);
    }

    for await (const peerEnr of this.nextPeer()) {
      if (!this._started) {
        return;
      }

      const { peerInfo, shardInfo } = peerEnr;

      if (!peerInfo) {
        continue;
      }

      const tagsToUpdate = {
        [DEFAULT_BOOTSTRAP_TAG_NAME]: {
          value: this._options.tagValue ?? DEFAULT_BOOTSTRAP_TAG_VALUE,
          ttl: this._options.tagTTL ?? DEFAULT_BOOTSTRAP_TAG_TTL
        }
      };

      let isPeerChanged = false;
      const isPeerAlreadyInPeerStore = await this._components.peerStore.has(
        peerInfo.id
      );

      if (isPeerAlreadyInPeerStore) {
        const peer = await this._components.peerStore.get(peerInfo.id);
        const hasBootstrapTag = peer.tags.has(DEFAULT_BOOTSTRAP_TAG_NAME);

        if (!hasBootstrapTag) {
          isPeerChanged = true;
          await this._components.peerStore.merge(peerInfo.id, {
            tags: tagsToUpdate
          });
        }
      } else {
        isPeerChanged = true;
        await this._components.peerStore.save(peerInfo.id, {
          tags: tagsToUpdate,
          ...(shardInfo && {
            metadata: {
              shardInfo: encodeRelayShard(shardInfo)
            }
          })
        });
      }

      if (isPeerChanged) {
        this.dispatchEvent(
          new CustomEvent<PeerInfo>("peer", { detail: peerInfo })
        );
      }
    }
  }

  /**
   * Stop emitting events
   */
  public stop(): void {
    this._started = false;
  }

  public get [symbol](): true {
    return true;
  }

  public get [Symbol.toStringTag](): string {
    return DNS_DISCOVERY_TAG;
  }
}

export function wakuDnsDiscovery(
  enrUrls: string[]
): (components: DnsDiscoveryComponents) => PeerDiscoveryDns {
  return (components: DnsDiscoveryComponents) =>
    new PeerDiscoveryDns(components, { enrUrls });
}

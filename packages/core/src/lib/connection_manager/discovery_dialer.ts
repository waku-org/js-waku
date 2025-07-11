import { Libp2p, Peer, PeerId, PeerInfo } from "@libp2p/interface";
import { Multiaddr } from "@multiformats/multiaddr";
import { Libp2pEventHandler } from "@waku/interfaces";
import { Logger } from "@waku/utils";

import { Dialer } from "./dialer.js";

type DiscoveryDialerConstructorOptions = {
  libp2p: Libp2p;
  dialer: Dialer;
};

interface IDiscoveryDialer {
  start(): void;
  stop(): void;
}

const log = new Logger("discovery-dialer");

/**
 * This class is responsible for dialing peers that are discovered by the libp2p node.
 * Managing limits for the peers is out of scope for this class.
 * Dialing after discovery is needed to identify the peer and get all other information: metadata, protocols, etc.
 */
export class DiscoveryDialer implements IDiscoveryDialer {
  private readonly libp2p: Libp2p;
  private readonly dialer: Dialer;

  public constructor(options: DiscoveryDialerConstructorOptions) {
    this.libp2p = options.libp2p;
    this.dialer = options.dialer;

    this.onPeerDiscovery = this.onPeerDiscovery.bind(this);
  }

  public start(): void {
    this.libp2p.addEventListener(
      "peer:discovery",
      this.onPeerDiscovery as Libp2pEventHandler<PeerInfo>
    );
  }

  public stop(): void {
    this.libp2p.removeEventListener(
      "peer:discovery",
      this.onPeerDiscovery as Libp2pEventHandler<PeerInfo>
    );
  }

  private async onPeerDiscovery(event: CustomEvent<PeerInfo>): Promise<void> {
    const peerId = event.detail.id;
    log.info(`Discovered new peer: ${peerId}`);

    try {
      await this.updatePeerStore(peerId, event.detail.multiaddrs);
      await this.dialer.dial(peerId);
    } catch (error) {
      log.error(`Error dialing peer ${peerId}`, error);
    }
  }

  private async updatePeerStore(
    peerId: PeerId,
    multiaddrs: Multiaddr[]
  ): Promise<void> {
    try {
      log.info(`Updating peer store for ${peerId}`);
      const peer = await this.getPeer(peerId);

      if (!peer) {
        log.info(`Peer ${peerId} not found in store, saving`);
        await this.libp2p.peerStore.save(peerId, {
          multiaddrs: multiaddrs
        });
        return;
      }

      const hasSameAddr = multiaddrs.every((addr) =>
        peer.addresses.some((a) => a.multiaddr.equals(addr))
      );

      if (hasSameAddr) {
        log.info(`Peer ${peerId} has same addresses in peer store, skipping`);
        return;
      }

      log.info(`Merging peer ${peerId} addresses in peer store`);
      await this.libp2p.peerStore.merge(peerId, {
        multiaddrs: multiaddrs
      });
    } catch (error) {
      log.error(`Error updating peer store for ${peerId}`, error);
    }
  }

  private async getPeer(peerId: PeerId): Promise<Peer | undefined> {
    try {
      return await this.libp2p.peerStore.get(peerId);
    } catch (error) {
      log.error(`Error getting peer info for ${peerId}`, error);
      return undefined;
    }
  }
}

import { PeerId, PeerInfo } from "@libp2p/interface";
import { Logger } from "@waku/utils";
import { Libp2p } from "libp2p";

type Libp2pEventHandler<T> = (e: CustomEvent<T>) => void;

type DiscoveryDialerConstructorOptions = {
  libp2p: Libp2p;
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

  private dialingInterval: NodeJS.Timeout | null = null;
  private dialingQueue: PeerId[] = [];

  public constructor(options: DiscoveryDialerConstructorOptions) {
    this.libp2p = options.libp2p;

    this.onPeerDiscovery = this.onPeerDiscovery.bind(this);
  }

  public start(): void {
    log.info("Starting discovery dialer");

    this.libp2p.addEventListener(
      "peer:discovery",
      this.onPeerDiscovery as Libp2pEventHandler<PeerInfo>
    );

    if (!this.dialingInterval) {
      this.dialingInterval = setInterval(() => {
        void this.processDialQueue();
      }, 500);

      log.info("Started dialing interval processor");
    }
  }

  public stop(): void {
    log.info("Stopping discovery dialer");

    this.libp2p.removeEventListener(
      "peer:discovery",
      this.onPeerDiscovery as Libp2pEventHandler<PeerInfo>
    );

    if (this.dialingInterval) {
      clearInterval(this.dialingInterval);
      this.dialingInterval = null;

      log.info("Stopped dialing interval processor");
    }
  }

  private async onPeerDiscovery(event: CustomEvent<PeerInfo>): Promise<void> {
    const peerId = event.detail.id;

    log.info(`Discovered new peer: ${peerId}`);

    try {
      if (this.dialingQueue.length > 0) {
        this.dialingQueue.push(peerId);

        log.info(
          `Added peer to dialing queue, queue size: ${this.dialingQueue.length}`
        );
      } else {
        log.info(`Dialing peer immediately: ${peerId}`);

        await this.libp2p.dial(peerId);

        log.info(`Successfully dialed peer: ${peerId}`);
      }
    } catch (error) {
      log.error(`Error dialing peer ${peerId}`, error);
    }
  }

  private async processDialQueue(): Promise<void> {
    if (this.dialingQueue.length === 0) return;

    const peersToDial = this.dialingQueue.slice(0, 3);
    this.dialingQueue = this.dialingQueue.slice(peersToDial.length);

    log.info(
      `Processing dial queue: dialing ${peersToDial.length} peers, ${this.dialingQueue.length} remaining in queue`
    );

    await Promise.all(
      peersToDial.map(async (peerId) => {
        try {
          log.info(`Dialing peer from queue: ${peerId}`);

          await this.libp2p.dial(peerId);

          log.info(`Successfully dialed peer from queue: ${peerId}`);
        } catch (error) {
          log.error(`Error dialing peer ${peerId}`, error);
        }
      })
    );
  }
}

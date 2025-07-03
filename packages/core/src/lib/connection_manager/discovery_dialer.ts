import { PeerInfo } from "@libp2p/interface";
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

export class DiscoveryDialer implements IDiscoveryDialer {
  private readonly libp2p: Libp2p;

  public constructor(options: DiscoveryDialerConstructorOptions) {
    this.libp2p = options.libp2p;

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

    try {
      await this.libp2p.dial(peerId);
    } catch (error) {
      log.error(`Error dialing peer ${peerId}`, error);
    }
  }
}

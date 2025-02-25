import { Connection, PeerId } from "@libp2p/interface";
import { Libp2p } from "@waku/interfaces";
import { Logger } from "@waku/utils";

const log = new Logger("peer-manager");

const DEFAULT_NUM_PEERS_TO_USE = 2;
const CONNECTION_LOCK_TAG = "peer-manager-lock";

type PeerManagerConfig = {
  numPeersToUse?: number;
};

type PeerManagerParams = {
  libp2p: Libp2p;
  config?: PeerManagerConfig;
};

export class PeerManager {
  private readonly numPeersToUse: number;

  private readonly libp2p: Libp2p;

  public constructor(params: PeerManagerParams) {
    this.onConnected = this.onConnected.bind(this);
    this.onDisconnected = this.onDisconnected.bind(this);

    this.numPeersToUse =
      params?.config?.numPeersToUse || DEFAULT_NUM_PEERS_TO_USE;

    this.libp2p = params.libp2p;

    this.startConnectionListener();
  }

  public stop(): void {
    this.stopConnectionListener();
  }

  public async getPeers(): Promise<PeerId[]> {
    return Promise.all(this.getLockedConnections().map((c) => c.remotePeer));
  }

  public async requestRenew(
    peerId: PeerId | string
  ): Promise<PeerId | undefined> {
    const lockedConnections = this.getLockedConnections();
    const neededPeers = this.numPeersToUse - lockedConnections.length;

    if (neededPeers === 0) {
      return;
    }

    const result = await Promise.all(
      this.getUnlockedConnections()
        .filter((c) => !c.remotePeer.equals(peerId))
        .slice(0, neededPeers)
        .map((c) => this.lockConnection(c))
        .map((c) => c.remotePeer)
    );

    const newPeerId = result[0];

    if (!newPeerId) {
      log.warn(
        `requestRenew: Couldn't renew peer ${peerId.toString()} - no peers.`
      );
      return;
    }

    log.info(
      `requestRenew: Renewed peer ${peerId.toString()} to ${newPeerId.toString()}`
    );

    return newPeerId;
  }

  private startConnectionListener(): void {
    this.libp2p.addEventListener("peer:connect", this.onConnected);
    this.libp2p.addEventListener("peer:disconnect", this.onDisconnected);
  }

  private stopConnectionListener(): void {
    this.libp2p.removeEventListener("peer:connect", this.onConnected);
    this.libp2p.removeEventListener("peer:disconnect", this.onDisconnected);
  }

  private onConnected(event: CustomEvent<PeerId>): void {
    const peerId = event.detail;
    void this.lockPeerIfNeeded(peerId);
  }

  private onDisconnected(event: CustomEvent<PeerId>): void {
    const peerId = event.detail;
    void this.requestRenew(peerId);
  }

  private async lockPeerIfNeeded(peerId: PeerId): Promise<void> {
    const lockedConnections = this.getLockedConnections();
    const neededPeers = this.numPeersToUse - lockedConnections.length;

    if (neededPeers === 0) {
      return;
    }

    this.getUnlockedConnections()
      .filter((c) => c.remotePeer.equals(peerId))
      .map((c) => this.lockConnection(c));
  }

  private getLockedConnections(): Connection[] {
    return this.libp2p
      .getConnections()
      .filter((c) => c.status === "open" && this.isConnectionLocked(c));
  }

  private getUnlockedConnections(): Connection[] {
    return this.libp2p
      .getConnections()
      .filter((c) => c.status === "open" && !this.isConnectionLocked(c));
  }

  private lockConnection(c: Connection): Connection {
    log.info(
      `requestRenew: Locking connection for peerId=${c.remotePeer.toString()}`
    );
    c.tags.push(CONNECTION_LOCK_TAG);
    return c;
  }

  private isConnectionLocked(c: Connection): boolean {
    return c.tags.includes(CONNECTION_LOCK_TAG);
  }
}

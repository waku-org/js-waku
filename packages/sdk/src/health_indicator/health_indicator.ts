import type { IdentifyResult, PeerId } from "@libp2p/interface";
import { FilterCodecs, LightPushCodec } from "@waku/core";
import { HealthStatus, IWakuEventEmitter, Libp2p } from "@waku/interfaces";
import { Logger } from "@waku/utils";

type PeerEvent<T> = (_event: CustomEvent<T>) => void;

const log = new Logger("health-indicator");

type HealthIndicatorParams = {
  libp2p: Libp2p;
  events: IWakuEventEmitter;
};

interface IHealthIndicator {
  start(): void;
  stop(): void;
  toValue(): HealthStatus;
}

export class HealthIndicator implements IHealthIndicator {
  private readonly libp2p: Libp2p;
  private readonly events: IWakuEventEmitter;

  private value: HealthStatus = HealthStatus.Unhealthy;

  public constructor(params: HealthIndicatorParams) {
    this.libp2p = params.libp2p;
    this.events = params.events;

    this.onPeerIdentify = this.onPeerIdentify.bind(this);
    this.onPeerDisconnected = this.onPeerDisconnected.bind(this);
  }

  public start(): void {
    log.info("start: adding listeners to libp2p");

    this.libp2p.addEventListener(
      "peer:identify",
      this.onPeerIdentify as PeerEvent<IdentifyResult>
    );
    this.libp2p.addEventListener(
      "peer:disconnect",
      this.onPeerDisconnected as PeerEvent<PeerId>
    );
  }

  public stop(): void {
    log.info("stop: removing listeners to libp2p");

    this.libp2p.removeEventListener(
      "peer:identify",
      this.onPeerIdentify as PeerEvent<IdentifyResult>
    );
    this.libp2p.removeEventListener(
      "peer:disconnect",
      this.onPeerDisconnected as PeerEvent<PeerId>
    );
  }

  public toValue(): HealthStatus {
    return this.value;
  }

  private async onPeerDisconnected(_event: CustomEvent<PeerId>): Promise<void> {
    log.info(`onPeerDisconnected: received libp2p event`);

    const connections = this.libp2p.getConnections();

    // we handle only Unhealthy here and onPeerIdentify will cover other cases
    if (connections.length > 0) {
      log.info("onPeerDisconnected: has connections, ignoring");
    }

    this.value = HealthStatus.Unhealthy;
    log.info(`onPeerDisconnected: node identified as ${this.value}`);

    this.dispatchHealthEvent();
  }

  private async onPeerIdentify(
    _event: CustomEvent<IdentifyResult>
  ): Promise<void> {
    log.info(`onPeerIdentify: received libp2p event`);

    const connections = this.libp2p.getConnections();

    const peers = await Promise.all(
      connections.map(async (c) => {
        try {
          return await this.libp2p.peerStore.get(c.remotePeer);
        } catch (e) {
          return null;
        }
      })
    );
    const filterPeers = peers.filter((p) =>
      p?.protocols.includes(FilterCodecs.SUBSCRIBE)
    ).length;
    const lightPushPeers = peers.filter((p) =>
      p?.protocols.includes(LightPushCodec)
    ).length;

    if (filterPeers === 0 || lightPushPeers === 0) {
      this.value = HealthStatus.Unhealthy;
    } else if (filterPeers >= 2 && lightPushPeers >= 2) {
      this.value = HealthStatus.SufficientlyHealthy;
    } else if (filterPeers === 1 && lightPushPeers === 1) {
      this.value = HealthStatus.MinimallyHealthy;
    } else {
      log.error(
        `onPeerChange: unexpected state, cannot identify health status of the node: Filter:${filterPeers}; LightPush:${lightPushPeers}`
      );
    }

    log.info(`onPeerChange: node identified as ${this.value}`);
    this.dispatchHealthEvent();
  }

  private dispatchHealthEvent(): void {
    this.events.dispatchEvent(
      new CustomEvent<HealthStatus>("waku:health", {
        detail: this.value
      })
    );
  }
}

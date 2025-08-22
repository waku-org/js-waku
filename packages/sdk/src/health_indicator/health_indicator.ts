import type { IdentifyResult, PeerId } from "@libp2p/interface";
import { FilterCodecs, LightPushCodec } from "@waku/core";
import { HealthStatus, IWakuEventEmitter, Libp2p } from "@waku/interfaces";
import { Logger } from "@waku/utils";
import debounce from "lodash.debounce";

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
  private isStarted = false;

  private readonly libp2p: Libp2p;
  private readonly events: IWakuEventEmitter;

  private value: HealthStatus = HealthStatus.Unhealthy;
  private readonly debouncedAssessHealth: ReturnType<typeof debounce>;

  public constructor(params: HealthIndicatorParams) {
    this.libp2p = params.libp2p;
    this.events = params.events;

    this.onPeerIdentify = this.onPeerIdentify.bind(this);
    this.onPeerDisconnected = this.onPeerDisconnected.bind(this);

    this.debouncedAssessHealth = debounce(() => {
      void this.assessHealth();
    }, 100);
  }

  public start(): void {
    if (this.isStarted) {
      return;
    }

    this.isStarted = true;
    log.info("start: adding listeners to libp2p");

    this.libp2p.addEventListener(
      "peer:identify",
      this.onPeerIdentify as PeerEvent<IdentifyResult>
    );
    this.libp2p.addEventListener(
      "peer:disconnect",
      this.onPeerDisconnected as PeerEvent<PeerId>
    );

    this.debouncedAssessHealth();
  }

  public stop(): void {
    if (!this.isStarted) {
      return;
    }

    this.isStarted = false;
    log.info("stop: removing listeners to libp2p");

    this.libp2p.removeEventListener(
      "peer:identify",
      this.onPeerIdentify as PeerEvent<IdentifyResult>
    );
    this.libp2p.removeEventListener(
      "peer:disconnect",
      this.onPeerDisconnected as PeerEvent<PeerId>
    );

    this.debouncedAssessHealth.cancel();
  }

  public toValue(): HealthStatus {
    return this.value;
  }

  private onPeerDisconnected(_event: CustomEvent<PeerId>): void {
    log.info(`onPeerDisconnected: received libp2p event`);
    this.debouncedAssessHealth();
  }

  private onPeerIdentify(_event: CustomEvent<IdentifyResult>): void {
    log.info(`onPeerIdentify: received libp2p event`);
    this.debouncedAssessHealth();
  }

  private async assessHealth(): Promise<void> {
    const connections = this.libp2p.getConnections();

    if (connections.length === 0) {
      log.info("assessHealth: no connections, setting to Unhealthy");
      this.updateAndDispatchHealthEvent(HealthStatus.Unhealthy);
      return;
    }

    const peers = await Promise.all(
      connections.map(async (c) => {
        try {
          return await this.libp2p.peerStore.get(c.remotePeer);
        } catch (e) {
          log.warn(
            `assessHealth: failed to get peer ${c.remotePeer}, skipping`
          );
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

    let newValue;
    if (filterPeers === 0 || lightPushPeers === 0) {
      newValue = HealthStatus.Unhealthy;
    } else if (filterPeers >= 2 && lightPushPeers >= 2) {
      newValue = HealthStatus.SufficientlyHealthy;
    } else if (filterPeers === 1 && lightPushPeers === 1) {
      newValue = HealthStatus.MinimallyHealthy;
    } else {
      log.error(
        `assessHealth: unexpected state, cannot identify health status of the node: Filter:${filterPeers}; LightPush:${lightPushPeers}`
      );
      newValue = this.value;
    }

    log.info(
      `assessHealth: node identified as ${newValue} Filter:${filterPeers}; LightPush:${lightPushPeers}`
    );
    this.updateAndDispatchHealthEvent(newValue);
  }

  private updateAndDispatchHealthEvent(newValue: HealthStatus): void {
    if (this.value !== newValue) {
      this.value = newValue;
      this.events.dispatchEvent(
        new CustomEvent<HealthStatus>("waku:health", {
          detail: this.value
        })
      );
    }
  }
}

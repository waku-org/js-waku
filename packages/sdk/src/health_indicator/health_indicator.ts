import { TypedEventEmitter } from "@libp2p/interface";
import type { IdentifyResult, PeerId } from "@libp2p/interface";
import { FilterCodecs, LightPushCodec } from "@waku/core";
import {
  HealthIndicatorEvents,
  HealthIndicatorParams,
  HealthStatus,
  HealthStatusChangeEvents,
  IHealthIndicator,
  Libp2p
} from "@waku/interfaces";
import { Logger } from "@waku/utils";

type PeerEvent<T> = (_event: CustomEvent<T>) => void;

const log = new Logger("health-indicator");

/**
 * HealthIndicator monitors the health status of a Waku node by tracking peer connections
 * and their supported protocols.
 *
 * The health status can be one of three states:
 * - Unhealthy: No peer connections
 * - MinimallyHealthy: At least 1 peer supporting both Filter and LightPush protocols
 * - SufficientlyHealthy: At least 2 peers supporting both Filter and LightPush protocols
 *
 * @example
 * // Create and start a health indicator
 * const healthIndicator = new HealthIndicator({ libp2p: node.libp2p });
 * healthIndicator.start();
 *
 * // Listen for health status changes
 * healthIndicator.addEventListener(HealthStatusChangeEvents.StatusChange, (event) => {
 *   console.log(`Health status changed to: ${event.detail}`);
 * });
 *
 * // Get current health status
 * console.log(`Current health: ${healthIndicator.toString()}`);
 *
 * // Clean up when done
 * healthIndicator.stop();
 *
 * @implements {IHealthIndicator}
 */
export class HealthIndicator
  extends TypedEventEmitter<HealthIndicatorEvents>
  implements IHealthIndicator
{
  private readonly libp2p: Libp2p;
  private value: HealthStatus = HealthStatus.Unhealthy;

  public constructor(params: HealthIndicatorParams) {
    super();
    this.libp2p = params.libp2p;

    this.onPeerIdentify = this.onPeerIdentify.bind(this);
    this.onPeerDisconnected = this.onPeerDisconnected.bind(this);
  }

  /**
   * Starts monitoring the health status by adding event listeners to libp2p events.
   * Listens to peer connect and disconnect events to determine the node's health status.
   */
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

  /**
   * Stops monitoring the health status by removing event listeners from libp2p events.
   * Cleans up the peer connect and disconnect event listeners.
   */
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

  /**
   * Returns the current health status as a string.
   * @returns {string} Current health status (Unhealthy, MinimallyHealthy, or SufficientlyHealthy)
   */
  public toString(): string {
    return this.value;
  }

  /**
   * Returns the current health status value.
   * @returns {string} Current health status (Unhealthy, MinimallyHealthy, or SufficientlyHealthy)
   */
  public toValue(): string {
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
    this.dispatchEvent(
      new CustomEvent<HealthStatus>(HealthStatusChangeEvents.StatusChange, {
        detail: this.value
      })
    );
  }
}

import {
  HealthStatus,
  type IHealthManager,
  type ProtocolHealth,
  Protocols,
  type ProtocolsHealthStatus
} from "@waku/interfaces";

export class HealthManager implements IHealthManager {
  private readonly health: ProtocolsHealthStatus;

  public constructor() {
    this.health = new Map();
  }

  public get healthStatus(): ProtocolsHealthStatus {
    return this.health;
  }

  public getProtocolStatus(protocol: Protocols): ProtocolHealth | undefined {
    return this.health.get(protocol);
  }

  protected updateProtocolHealth(
    protocol: Protocols,
    connectedPeers: number
  ): void {
    let status: HealthStatus = HealthStatus.Unhealthy;
    if (connectedPeers == 1) {
      status = HealthStatus.MinimallyHealthy;
    } else if (connectedPeers >= 2) {
      status = HealthStatus.SufficientlyHealthy;
    }

    this.health.set(protocol, {
      name: protocol,
      status: status,
      lastUpdate: new Date()
    });
  }
}

import {
  HealthStatus,
  type IHealthManager,
  NodeHealth,
  type ProtocolHealth,
  Protocols
} from "@waku/interfaces";

class HealthManager implements IHealthManager {
  public static instance: HealthManager;
  private readonly health: NodeHealth;

  private constructor() {
    this.health = {
      overallStatus: HealthStatus.Unhealthy,
      protocolStatuses: new Map()
    };
  }

  public static getInstance(): HealthManager {
    if (!HealthManager.instance) {
      HealthManager.instance = new HealthManager();
    }
    return HealthManager.instance;
  }

  public getHealthStatus(): HealthStatus {
    return this.health.overallStatus;
  }

  public getProtocolStatus(protocol: Protocols): ProtocolHealth | undefined {
    return this.health.protocolStatuses.get(protocol);
  }

  public updateProtocolHealth(
    protocol: Protocols,
    connectedPeers: number
  ): void {
    let status: HealthStatus = HealthStatus.Unhealthy;
    if (connectedPeers == 1) {
      status = HealthStatus.MinimallyHealthy;
    } else if (connectedPeers >= 2) {
      status = HealthStatus.SufficientlyHealthy;
    }

    this.health.protocolStatuses.set(protocol, {
      name: protocol,
      status: status,
      lastUpdate: new Date()
    });

    this.updateOverallHealth();
  }

  private updateOverallHealth(): void {
    const statuses = Array.from(this.health.protocolStatuses.values()).map(
      (p) => p.status
    );

    if (statuses.some((status) => status === HealthStatus.Unhealthy)) {
      this.health.overallStatus = HealthStatus.Unhealthy;
    } else if (
      statuses.every((status) => status === HealthStatus.SufficientlyHealthy)
    ) {
      this.health.overallStatus = HealthStatus.SufficientlyHealthy;
    } else {
      this.health.overallStatus = HealthStatus.MinimallyHealthy;
    }
  }
}

export const getHealthManager = (): HealthManager =>
  HealthManager.getInstance();

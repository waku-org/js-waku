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
    const relevantProtocols = [Protocols.LightPush, Protocols.Filter];
    const statuses = relevantProtocols.map(
      (p) => this.getProtocolStatus(p)?.status
    );

    if (statuses.some((status) => status === HealthStatus.Unhealthy)) {
      this.health.overallStatus = HealthStatus.Unhealthy;
    } else if (
      statuses.some((status) => status === HealthStatus.MinimallyHealthy)
    ) {
      this.health.overallStatus = HealthStatus.MinimallyHealthy;
    } else {
      this.health.overallStatus = HealthStatus.SufficientlyHealthy;
    }
  }
}

export const getHealthManager = (): HealthManager =>
  HealthManager.getInstance();

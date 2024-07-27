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
    multicodec: string,
    connectedPeers: number
  ): void {
    const protocol = this.getNameFromMulticodec(multicodec);

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

  private getNameFromMulticodec(multicodec: string): Protocols {
    let name: Protocols;
    if (multicodec.includes("filter")) {
      name = Protocols.Filter;
    } else if (multicodec.includes("lightpush")) {
      name = Protocols.LightPush;
    } else if (multicodec.includes("store")) {
      name = Protocols.Store;
    } else {
      throw new Error(`Unknown protocol: ${multicodec}`);
    }
    return name;
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

import {
  HealthStatus,
  type IHealthManager,
  type ProtocolHealth,
  Protocols,
  type ProtocolsHealthStatus
} from "@waku/interfaces";

class HealthManager implements IHealthManager {
  public static instance: HealthManager;
  private readonly health: ProtocolsHealthStatus;

  private constructor() {
    this.health = new Map();
  }

  public static getInstance(): HealthManager {
    if (!HealthManager.instance) {
      HealthManager.instance = new HealthManager();
    }
    return HealthManager.instance;
  }

  public getHealthStatus(): ProtocolsHealthStatus {
    return this.health;
  }

  public getProtocolStatus(protocol: Protocols): ProtocolHealth | undefined {
    return this.health.get(protocol);
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

    this.health.set(protocol, {
      name: protocol,
      status: status,
      lastUpdate: new Date()
    });
  }
}

export const getHealthManager = (): HealthManager =>
  HealthManager.getInstance();

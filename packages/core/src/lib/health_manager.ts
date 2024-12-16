import {
  HealthEvent,
  HealthEventType,
  HealthListener,
  HealthStatus,
  type IHealthManager,
  NodeHealth,
  type ProtocolHealth,
  Protocols
} from "@waku/interfaces";

class HealthManager implements IHealthManager {
  public static instance: HealthManager;
  private readonly health: NodeHealth;
  private listeners: Map<HealthEventType, Set<HealthListener>>;

  private constructor() {
    this.health = {
      overallStatus: HealthStatus.Unhealthy,
      protocolStatuses: new Map()
    };
    this.listeners = new Map();
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

    this.emitEvent({
      type: "health:protocol",
      status,
      protocol,
      timestamp: new Date()
    });

    this.updateOverallHealth();
  }

  public addEventListener(
    type: HealthEventType,
    listener: HealthListener
  ): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)?.add(listener);
  }

  public removeEventListener(
    type: HealthEventType,
    listener: HealthListener
  ): void {
    this.listeners.get(type)?.delete(listener);
  }

  private emitEvent(event: HealthEvent): void {
    this.listeners.get(event.type)?.forEach((listener) => listener(event));
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

    let newStatus: HealthStatus;
    if (statuses.some((status) => status === HealthStatus.Unhealthy)) {
      newStatus = HealthStatus.Unhealthy;
    } else if (
      statuses.some((status) => status === HealthStatus.MinimallyHealthy)
    ) {
      newStatus = HealthStatus.MinimallyHealthy;
    } else {
      newStatus = HealthStatus.SufficientlyHealthy;
    }

    if (this.health.overallStatus !== newStatus) {
      this.health.overallStatus = newStatus;
      this.emitEvent({
        type: "health:overall",
        status: newStatus,
        timestamp: new Date()
      });
    }
  }
}

export const getHealthManager = (): HealthManager =>
  HealthManager.getInstance();

import { Protocols } from "./protocols.js";

export enum HealthStatus {
  Unhealthy = "Unhealthy",
  MinimallyHealthy = "MinimallyHealthy",
  SufficientlyHealthy = "SufficientlyHealthy"
}

export type HealthEventType = "health:overall" | "health:protocol";

export interface HealthEvent {
  type: HealthEventType;
  status: HealthStatus;
  protocol?: Protocols;
  timestamp: Date;
}

export type HealthListener = (event: HealthEvent) => void;

export interface IHealthManager {
  getHealthStatus: () => HealthStatus;
  getProtocolStatus: (protocol: Protocols) => ProtocolHealth | undefined;
  updateProtocolHealth: (multicodec: string, connectedPeers: number) => void;

  addEventListener: (type: HealthEventType, listener: HealthListener) => void;
  removeEventListener: (
    type: HealthEventType,
    listener: HealthListener
  ) => void;
}

export type NodeHealth = {
  overallStatus: HealthStatus;
  protocolStatuses: ProtocolsHealthStatus;
};

export type ProtocolHealth = {
  name: Protocols;
  status: HealthStatus;
  lastUpdate: Date;
};

export type ProtocolsHealthStatus = Map<Protocols, ProtocolHealth>;

import { Protocols } from "./protocols.js";

export enum HealthStatus {
  Unhealthy = "Unhealthy",
  MinimallyHealthy = "MinimallyHealthy",
  SufficientlyHealthy = "SufficientlyHealthy"
}

export interface IHealthManager {
  getHealthStatus: () => HealthStatus;
  getProtocolStatus: (protocol: Protocols) => ProtocolHealth | undefined;
  updateProtocolHealth: (multicodec: string, connectedPeers: number) => void;
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

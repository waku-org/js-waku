import { Protocols } from "./protocols";

export enum HealthStatus {
  Unhealthy = "Unhealthy",
  MinimallyHealthy = "MinimallyHealthy",
  SufficientlyHealthy = "SufficientlyHealthy"
}

export interface IHealthManager {
  getHealthStatus: () => ProtocolsHealthStatus;
  getProtocolStatus: (protocol: Protocols) => ProtocolHealth | undefined;
  updateProtocolHealth: (protocol: Protocols, connectedPeers: number) => void;
}

export type ProtocolHealth = {
  name: Protocols;
  status: HealthStatus;
  lastUpdate: Date;
};

export type ProtocolsHealthStatus = Map<Protocols, ProtocolHealth>;

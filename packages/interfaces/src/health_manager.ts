import { Protocols } from "./protocols";

export enum HealthStatus {
  Unhealthy = "Unhealthy",
  MinimallyHealthy = "MinimallyHealthy",
  SufficientlyHealthy = "SufficientlyHealthy"
}

export interface IHealthManager {
  healthStatus: ProtocolsHealthStatus;
  getProtocolStatus: (protocol: Protocols) => ProtocolHealth | undefined;
}

export type ProtocolHealth = {
  name: Protocols;
  status: HealthStatus;
  lastUpdate: Date;
};

export type ProtocolsHealthStatus = Map<Protocols, ProtocolHealth>;

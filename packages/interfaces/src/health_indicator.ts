import { TypedEventEmitter } from "@libp2p/interface";

import { Libp2p } from "./libp2p.js";

export enum HealthStatusChangeEvents {
  StatusChange = "health:change"
}

export enum HealthStatus {
  Unhealthy = "Unhealthy",
  MinimallyHealthy = "MinimallyHealthy",
  SufficientlyHealthy = "SufficientlyHealthy"
}

export type HealthIndicatorEvents = {
  [HealthStatusChangeEvents.StatusChange]: CustomEvent<HealthStatus>;
};

export interface IHealthIndicator
  extends TypedEventEmitter<HealthIndicatorEvents> {}

export type HealthIndicatorParams = {
  libp2p: Libp2p;
};

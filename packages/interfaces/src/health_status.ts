export enum HealthStatus {
  /**
   * No peer connections
   */
  Unhealthy = "Unhealthy",

  /**
   * At least 1 peer supporting both Filter and LightPush protocols
   */
  MinimallyHealthy = "MinimallyHealthy",

  /**
   * At least 2 peers supporting both Filter and LightPush protocols
   */
  SufficientlyHealthy = "SufficientlyHealthy"
}

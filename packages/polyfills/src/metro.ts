import type { MetroConfig } from "expo/metro-config";

export function setupWakuMetroConfig(config: MetroConfig): void {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const path = require("path");

  config.resolver.unstable_enablePackageExports = true;
  config.resolver.extraNodeModules = {
    url: path.resolve(__dirname, "node_modules", "react-native-url-polyfill")
  };
}

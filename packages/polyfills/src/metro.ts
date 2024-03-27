import type { MetroConfig } from "expo/metro-config";

type Writeable<T> = { -readonly [P in keyof T]: Writeable<T[P]> };

export function setupWakuMetroConfig(config: Writeable<MetroConfig>): void {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const path = require("path");

  config.resolver.unstable_enablePackageExports = true;
  config.resolver.extraNodeModules = {
    url: path.resolve(__dirname, "node_modules", "react-native-url-polyfill")
  };
}

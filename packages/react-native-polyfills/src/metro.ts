import path, { dirname } from "path";
import { fileURLToPath } from "url";

import type { MetroConfig } from "expo/metro-config";

const __dirname = dirname(fileURLToPath(import.meta.url));

type Writeable<T> = { -readonly [P in keyof T]: Writeable<T[P]> };

export function setupWakuMetroConfig(config: Writeable<MetroConfig>): void {
  config.resolver.unstable_enablePackageExports = true;
  config.resolver.extraNodeModules = {
    url: path.resolve(__dirname, "node_modules", "react-native-url-polyfill")
  };
}

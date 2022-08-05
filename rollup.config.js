import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";

export default {
  input: {
    index: "dist/index.js",
    "lib/create_waku": "dist/lib/create_waku.js",
    "lib/peer_discovery_dns": "dist/lib/peer_discovery_dns/index.js",
  },
  output: {
    dir: "bundle",
    format: "esm",
  },
  plugins: [
    commonjs(),
    json(),
    nodeResolve({
      browser: true,
      preferBuiltins: false,
    }),
  ],
};

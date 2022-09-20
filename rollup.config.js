import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";

export default {
  input: {
    index: "dist/index.js",
    "lib/create_waku": "dist/lib/create_waku.js",
    "lib/peer_discovery_dns": "dist/lib/peer_discovery_dns/index.js",
    "lib/peer_discovery_static_list": "dist/lib/peer_discovery_static_list.js",
    "lib/predefined_bootstrap_nodes": "dist/lib/predefined_bootstrap_nodes.js",
    "lib/wait_for_remote_peer": "dist/lib/wait_for_remote_peer.js",
    "lib/waku_message/version_0": "dist/lib/waku_message/version_0.js",
    "lib/waku_message/version_1": "dist/lib/waku_message/version_1.js",
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

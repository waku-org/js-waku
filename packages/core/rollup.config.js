import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import { nodeResolve } from "@rollup/plugin-node-resolve";

export default {
  input: {
    index: "dist/index.js",
    "lib/predefined_bootstrap_nodes": "dist/lib/predefined_bootstrap_nodes.js",
    "lib/waku_message/version_0": "dist/lib/waku_message/version_0.js",
    "lib/waku_message/topic_only_message":
      "dist/lib/waku_message/topic_only_message.js",
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

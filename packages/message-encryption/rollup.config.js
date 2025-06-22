import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import { extractExports } from "@waku/build-utils";

import * as packageJson from "./package.json" with { type: "json" };

const input = extractExports(packageJson);

export default {
  input,
  output: {
    dir: "bundle",
    format: "esm"
  },
  plugins: [
    commonjs(),
    json(),
    nodeResolve({
      browser: true,
      preferBuiltins: false
    })
  ]
};

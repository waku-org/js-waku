import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import { extractExports } from "@waku/build-utils";
import replace from "rollup-plugin-replace";

import * as packageJson from "./package.json" assert { type: "json" };

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
    replace({
      "process.env.NODE_ENV": "production"
    }),
    nodeResolve({
      browser: true,
      preferBuiltins: false
    })
  ]
};

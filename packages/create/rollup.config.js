import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";

export default {
  input: {
    index: "dist/index.js",
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

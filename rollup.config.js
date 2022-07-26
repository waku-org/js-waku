import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import nodePolyfills from "rollup-plugin-polyfill-node";

export default {
  output: {
    file: "dist/bundle.js",
    format: "esm",
    name: "waku",
  },
  plugins: [
    commonjs(),
    json(),
    nodePolyfills(),
    nodeResolve({
      browser: true,
      preferBuiltins: false,
    }),
  ],
};

import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import nodePolyfills from "rollup-plugin-polyfill-node";

export default {
  output: {
    file: "dist/umd/index.umd.js",
    format: "umd",
    name: "jswaku",
  },
  plugins: [
    commonjs(),
    json(),
    nodePolyfills({ sourceMap: true }),
    nodeResolve({
      browser: true,
    }),
  ],
};

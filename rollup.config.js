import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import filesize from "rollup-plugin-filesize";
import json from "@rollup/plugin-json";
import nodePolyfills from "rollup-plugin-polyfill-node";

export default {
  output: {
    file: "dist/umd/index.js",
    format: "umd",
    name: "jswaku",
  },
  plugins: [
    commonjs(),
    filesize(),
    json(),
    nodePolyfills({ sourceMap: true }),
    nodeResolve({
      browser: true,
    }),
  ],
};

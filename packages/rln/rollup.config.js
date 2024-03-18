import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import { wasm } from "@rollup/plugin-wasm";
import copy from "rollup-plugin-copy";
import { importMetaAssets } from "@web/rollup-plugin-import-meta-assets";
export default {
  input: {
    index: "dist/index.js",
  },
  output: {
    dir: "bundle",
    format: "esm",
  },
  plugins: [
    copy({
      hook: "buildStart",
      targets: [
        { src: "src/resources/rln.wasm", dest: "dist/resources" },
        { src: "src/resources/rln_final.zkey", dest: "dist/resources" },
      ],
    }),
    commonjs(),
    json(),
    wasm({
      maxFileSize: 0,
    }),
    nodeResolve({
      browser: true,
      preferBuiltins: false,
      extensions: [".js", ".ts", ".wasm"],
    }),
    importMetaAssets(),
  ],
};

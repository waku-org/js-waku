import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import typescript from "rollup-plugin-typescript2";

const input = "src/index.ts";

const external = [
  "react",
  "react-dom",
  "@waku/interfaces",
  "@waku/sdk",
  "@waku/utils"
];

export default [
  {
    input,
    output: {
      file: "dist/index.esm.mjs",
      format: "esm",
      sourcemap: true
    },
    external,
    plugins: [
      nodeResolve({
        browser: true,
        preferBuiltins: false
      }),
      commonjs(),
      json(),
      typescript({
        tsconfig: "./tsconfig.json",
        useTsconfigDeclarationDir: true
      })
    ]
  },
  {
    input,
    output: {
      file: "dist/index.cjs.js",
      format: "cjs",
      sourcemap: true,
      exports: "named"
    },
    external,
    plugins: [
      nodeResolve({
        browser: true,
        preferBuiltins: false
      }),
      commonjs(),
      json(),
      typescript({
        tsconfig: "./tsconfig.json",
        tsconfigOverride: {
          compilerOptions: {
            declaration: false
          }
        }
      })
    ]
  },
  {
    input,
    output: {
      file: "dist/index.umd.js",
      format: "umd",
      name: "WakuReact",
      sourcemap: true,
      globals: {
        react: "React",
        "react-dom": "ReactDOM",
        "@waku/interfaces": "WakuInterfaces",
        "@waku/sdk": "WakuSDK",
        "@waku/utils": "WakuUtils"
      }
    },
    external,
    plugins: [
      nodeResolve({
        browser: true,
        preferBuiltins: false
      }),
      commonjs(),
      json(),
      typescript({
        tsconfig: "./tsconfig.json",
        tsconfigOverride: {
          compilerOptions: {
            declaration: false
          }
        }
      }),
      terser()
    ]
  }
];

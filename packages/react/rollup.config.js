import commonjs from "@rollup/plugin-commonjs";
import external from "rollup-plugin-peer-deps-external";
import sourcemaps from "rollup-plugin-sourcemaps";
import { terser } from "rollup-plugin-terser";
import typescript from "rollup-plugin-typescript2";

function createRollupConfig(options) {
  const name = options.name;
  // A file with the extension ".mjs" will always be treated as ESM, even when pkg.type is "commonjs" (the default)
  // https://nodejs.org/docs/latest/api/packages.html#packages_determining_module_system
  const extName = options.format === "esm" ? "mjs" : "js";
  const outputName = "dist/" + [name, options.format, extName].join(".");

  const config = {
    input: "src/index.ts",
    output: {
      file: outputName,
      format: options.format,
      name: "@waku/react",
      sourcemap: true,
      globals: { react: "React" },
      exports: "named"
    },
    plugins: [
      external(),
      typescript({
        tsconfig: options.tsconfig,
        clean: true,
        exclude: ["**/__tests__", "**/*.test.ts"]
      }),
      options.format === "umd" &&
        commonjs({
          include: /\/node_modules\//
        }),
      sourcemaps(),
      options.format !== "esm" &&
        terser({
          output: { comments: false },
          compress: {
            drop_console: true
          }
        })
    ].filter(Boolean)
  };

  return config;
}

const name = "index";
const source = "src/index.ts";

const options = [
  {
    name,
    format: "cjs",
    input: source
  },
  { name, format: "esm", input: source },
  {
    name,
    format: "umd",
    input: source
  }
];

export default options.map((option) => createRollupConfig(option));

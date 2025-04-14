/* eslint-disable @typescript-eslint/no-var-requires */
const path = require("path");

const NodePolyfillPlugin = require("node-polyfill-webpack-plugin");

module.exports = {
  entry: "./index.js",
  output: {
    filename: "bundle.js",
    path: path.resolve(__dirname, "build")
  },
  mode: "production",
  target: "web",
  plugins: [new NodePolyfillPlugin()],
  resolve: {
    extensions: [".js", ".ts", ".tsx", ".jsx"],
    fallback: {
      fs: false,
      net: false,
      tls: false
    },
    alias: {
      // Create an alias to easily import from src
      "@src": path.resolve(__dirname, "../src")
    }
  },
  module: {
    rules: [
      {
        test: /\.(js|ts|tsx)$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: ["@babel/preset-env", "@babel/preset-typescript"]
          }
        }
      }
    ]
  }
};

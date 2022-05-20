const webpack = require("webpack");
const path = require("path");

module.exports = {
  mode: "development",
  entry: {
    "js-waku": "./src/index.ts",
  },
  devtool: "inline-source-map",
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: "ts-loader",
        exclude: /(node_modules)|(node\.spec\.ts)/,
      },
      {
        test: /node\.spec\.ts$/,
        use: "ignore-loader",
      },
    ],
  },
  plugins: [
    new webpack.ProvidePlugin({
      process: "process/browser.js",
      Buffer: ["buffer", "Buffer"],
    }),
  ],
  resolve: {
    extensions: [".ts", ".js"],
    fallback: {
      buffer: require.resolve("buffer/"),
      crypto: false,
      stream: require.resolve("stream-browserify"),
    },
  },
  output: {
    filename: "[name].js",
    path: path.resolve(__dirname, "build/umd"),
    library: "jswaku",
    libraryTarget: "umd",
    globalObject: "this",
  },
  optimization: {
    splitChunks: {
      name: "vendors",
      chunks: "all",
    },
  },
};

const webpack = require("webpack");
const playwright = require('playwright');

process.env.CHROME_BIN = playwright.chromium.executablePath();
process.env.FIREFOX_BIN = playwright.firefox.executablePath();
process.env.WEBKIT_HEADLESS_BIN = playwright.webkit.executablePath();

module.exports = function (config) {
  config.set({
    frameworks: ["webpack", "mocha"],
    files: ["src/**/!(node).spec.ts"],
    preprocessors: {
      "src/**/!(node).spec.ts": ["webpack"]
    },
    envPreprocessor: ["CI"],
    reporters: ["progress"],
    browsers: ["ChromeHeadless", "Firefox", "WebkitHeadless"],
    singleRun: true,
    client: {
      mocha: {
        timeout: 6000 // Default is 2s
      }
    },
    webpack: {
      mode: "development",
      module: {
        rules: [{ test: /\.([cm]?ts|tsx)$/, loader: "ts-loader" }]
      },
      plugins: [
        new webpack.DefinePlugin({
          "process.env.CI": process.env.CI || false
        }),
        new webpack.ProvidePlugin({
          process: "process/browser.js"
        })
      ],
      resolve: {
        extensions: [".ts", ".tsx", ".js"],
        extensionAlias: {
          ".js": [".js", ".ts"],
          ".cjs": [".cjs", ".cts"],
          ".mjs": [".mjs", ".mts"]
        }
      },
      stats: { warnings: false },
      devtool: "inline-source-map"
    }
  });
};

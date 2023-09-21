process.env.CHROME_BIN = require("puppeteer").executablePath();
const webpack = require("webpack");

module.exports = function (config) {
  config.set({
    frameworks: ["webpack", "mocha"],
    files: ["src/**/!(node).spec.ts"],
    preprocessors: {
      "src/**/!(node).spec.ts": ["webpack"]
    },
    envPreprocessor: ["CI"],
    reporters: ["progress"],
    browsers: ["ChromeHeadless"],
    singleRun: true,
    client: {
      mocha: {
        timeout: 6000 // Default is 2s
      }
    },
    webpack: {
      mode: "development",
      module: {
        rules: [
          {
            test: /\.([cm]?ts|tsx)$/,
            loader: "ts-loader"
          }, {
            test: /\.m?js/,
            resolve: {
              fullySpecified: false
            }
          }
        ]
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

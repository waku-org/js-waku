process.env.CHROME_BIN = require("puppeteer").executablePath();
const webpack = require("webpack");

module.exports = function (config) {
  config.set({
    frameworks: ["webpack", "mocha"],
    files: ["src/lib/**/!(node).spec.ts"],
    preprocessors: {
      "src/lib/**/!(node).spec.ts": ["webpack"],
    },
    envPreprocessor: ["CI"],
    reporters: ["progress"],
    browsers: ["ChromeHeadless"],
    singleRun: true,
    client: {
      mocha: {
        timeout: 6000, // Default is 2s
      },
    },
    webpack: {
      mode: "production",
      module: {
        rules: [
          {
            test: /\.(js|tsx?)$/,
            use: [
              {
                loader: "ts-loader",
                options: { configFile: "tsconfig.karma.json" },
              },
            ],
            exclude: /(node_modules)|(node\.spec\.ts)/,
          },
          {
            test: /node\.spec\.ts$/,
            use: "ignore-loader",
          },
        ],
      },
      plugins: [
        new webpack.DefinePlugin({
          "process.env.CI": process.env.CI || false,
        }),
        new webpack.ProvidePlugin({
          process: "process/browser.js",
        }),
      ],
      resolve: {
        extensions: [".ts", ".js"],
      },
      stats: { warnings: false },
      devtool: "inline-source-map",
    },
  });
};

process.env.CHROME_BIN = require("puppeteer").executablePath();

module.exports = function (config) {
  config.set({
    frameworks: ["mocha", "karma-typescript"],
    files: ["src/lib/**/*.ts", "src/proto/**/*.ts"],
    preprocessors: {
      "**/*.ts": ["karma-typescript", "env"],
    },
    envPreprocessor: ["CI"],
    plugins: [
      require("karma-mocha"),
      require("karma-typescript"),
      require("karma-chrome-launcher"),
      require("karma-env-preprocessor"),
    ],
    reporters: ["progress", "karma-typescript"],
    browsers: ["ChromeHeadless"],
    singleRun: true,
    client: {
      mocha: {
        timeout: 6000, // Default is 2s
      },
    },
    karmaTypescriptConfig: {
      bundlerOptions: {
        entrypoints: /^.*[^(node)]\.spec\.ts$/,
      },
      coverageOptions: {
        instrumentation: false,
      },
      tsconfig: "./tsconfig.json",
      compilerOptions: {
        noEmit: false,
      },
      include: {
        mode: "replace",
        values: ["src/lib/**/*.ts", "src/proto/**/*.ts"],
      },
      exclude: {
        mode: "replace",
        values: ["node_modules/**"],
      },
    },
  });
};

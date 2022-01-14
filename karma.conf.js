process.env.CHROME_BIN = require('puppeteer').executablePath();

module.exports = function (config) {
  config.set({
    frameworks: ['mocha', 'karma-typescript'],
    files: ['src/lib/**/*.ts', 'src/proto/**/*.ts'],
    preprocessors: {
      '**/*.ts': ['karma-typescript'],
    },
    plugins: [
      require('karma-mocha'),
      require('karma-typescript'),
      require('karma-chrome-launcher'),
      require('karma-verbose-reporter'),
    ],
    reporters: ['progress', 'karma-typescript', 'verbose'],
    browsers: ['ChromeHeadless'],
    singleRun: true,
    client: {
      mocha: {
        timeout: 20000, // Default is 2s
      },
    },
    karmaTypescriptConfig: {
      bundlerOptions: {
        entrypoints: /^.*[^(node)]\.spec\.ts$/,
      },
      coverageOptions: {
        instrumentation: false,
      },
      tsconfig: './tsconfig.json',
      compilerOptions: {
        noEmit: false,
      },
      include: {
        mode: 'replace',
        values: ['src/lib/**/*.ts', 'src/proto/**/*.ts'],
      },
      exclude: {
        mode: 'replace',
        values: ['node_modules/**'],
      },
    },
  });
};

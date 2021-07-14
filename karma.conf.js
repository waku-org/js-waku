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
    ],
    reporters: ['progress', 'karma-typescript'],
    browsers: ['ChromeHeadless'],
    singleRun: true,
    karmaTypescriptConfig: {
      bundlerOptions: {
        entrypoints: /.*\.browser\.spec\.ts$/,
      },
      tsconfig: './tsconfig.karma.json',
      coverageOptions: {
        instrumentation: false,
      },
    },
  });
};

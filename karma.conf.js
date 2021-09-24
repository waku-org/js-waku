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

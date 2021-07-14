module.exports = function (config) {
  config.set({
    frameworks: ['mocha', 'karma-typescript'],
    files: [{ pattern: 'src/**/*browser.spec.ts' }],
    preprocessors: {
      '**/*.ts': ['karma-typescript'],
    },
    plugins: [
      require('karma-mocha'),
      require('karma-typescript'),
      require('karma-chrome-launcher'),
    ],
    logLevel: config.LOG_DEBUG,
    reporters: ['progress', 'karma-typescript'],
    browsers: ['Chromium'],
    singleRun: true,
    karmaTypescriptConfig: {
      tsconfig: './tsconfig.karma.json',
      coverageOptions: {
        instrumentation: false,
      },
    },
  });
};

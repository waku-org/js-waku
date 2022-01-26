import puppeteer from 'puppeteer';
import karma_mocha from 'karma-mocha';
import karma_typescript from 'karma-typescript';
import karma_chrome_launcher from 'karma-chrome-launcher';

process.env.CHROME_BIN = puppeteer.executablePath();

export default function (config) {
  config.set({
    frameworks: ['mocha', 'karma-typescript'],
    files: ['src/lib/**/*.ts', 'src/proto/**/*.ts'],
    preprocessors: {
      '**/*.ts': ['karma-typescript'],
    },
    plugins: [karma_mocha, karma_typescript, karma_chrome_launcher],
    reporters: ['progress', 'karma-typescript'],
    browsers: ['ChromeHeadless'],
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
}

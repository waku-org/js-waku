const config = {
  extension: ['ts'],
  require: ['ts-node/register', 'isomorphic-fetch'],
  loader: 'ts-node/esm',
  'node-option': [
    'experimental-specifier-resolution=node',
    'loader=ts-node/esm'
  ],
  exit: true,
  retries: 4
};

if (process.env.CI) {
  console.log("Running tests in parallel");
  config.parallel = true;
  config.jobs = 6;
  console.log("Using multi reporters for test results");
  config.reporter = 'spec';

  // Write JSON results to file without printing to console
  if (process.env.REPORT_PATH) {
    const fs = require('fs');
    const path = require('path');
    const reportDir = path.dirname(process.env.REPORT_PATH);
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    config.reporter = 'mocha-multi-reporters';
    config.reporterOptions = {
      reporterEnabled: 'spec, json',
      reporterOptions: {
        json: {
          stdout: '/dev/null',  // Don't print JSON to stdout
          options: { output: process.env.REPORT_PATH }
        }
      }
    };
  }
} else {
  console.log("Running tests serially. To enable parallel execution update mocha config");
}

module.exports = config;

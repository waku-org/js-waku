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
  console.log("Using JSON reporter for test results");
  config.reporter = 'json';
  config.reporterOptions = {
    output: 'reports/mocha-results.json'
  };
} else {
  console.log("Running tests serially. To enable parallel execution update mocha config");
}

module.exports = config;

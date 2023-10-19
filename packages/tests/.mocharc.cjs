const config = {
  extension: ['ts'],
  require: ['ts-node/register', 'isomorphic-fetch'],
  loader: 'ts-node/esm',
  'node-option': [  // Note the corrected property name
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
  console.log("Activating allure reporting");
  config.reporter = 'mocha-multi-reporters';  // Note the corrected property name
  config.reporterOptions = {  // Note the corrected property name
    configFile: '.mocha.reporters.json'
  };
} else {
  console.log("Running tests serially. To enable parallel execution update mocha config");
}

module.exports = config;

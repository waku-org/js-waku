// import settings from default config file
let properties = null;
const originalConfigFn = require('./karma.conf.js');
originalConfigFn({
  set: function (arg) {
    properties = arg;
  },
});

// pass `--grep '[live data]'` to mocha to only run live data tests
properties.client.args = ['--grep', '[live data]]'];

// export settings
module.exports = function (config) {
  config.set(properties);
};

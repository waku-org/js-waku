const webpack = require('webpack');

module.exports = {
  dev: (config) => {
    // Override webpack 5 config from react-scripts to load polyfills
    if (!config.resolve) config.resolve = {};
    if (!config.resolve.fallback) config.resolve.fallback = {};
    Object.assign(config.resolve.fallback, {
      buffer: require.resolve('buffer'),
      crypto: false,
      stream: require.resolve('stream-browserify'),
    });

    if (!config.plugins) config.plugins = [];
    config.plugins.push(
      new webpack.DefinePlugin({
        'process.env.ENV': JSON.stringify('dev'),
      })
    );
    config.plugins.push(
      new webpack.ProvidePlugin({
        process: 'process/browser.js',
        Buffer: ['buffer', 'Buffer'],
      })
    );

    if (!config.ignoreWarnings) config.ignoreWarnings = [];
    config.ignoreWarnings.push(/Failed to parse source map/);

    return config;
  },
  prod: (config) => {
    // Override webpack 5 config from react-scripts to load polyfills
    if (!config.resolve) config.resolve = {};
    if (!config.resolve.fallback) config.resolve.fallback = {};
    Object.assign(config.resolve.fallback, {
      buffer: require.resolve('buffer'),
      crypto: false,
      stream: require.resolve('stream-browserify'),
    });

    if (!config.plugins) config.plugins = [];
    config.plugins.push(
      new webpack.DefinePlugin({
        'process.env.ENV': JSON.stringify('prod'),
      })
    );
    config.plugins.push(
      new webpack.ProvidePlugin({
        process: 'process/browser.js',
        Buffer: ['buffer', 'Buffer'],
      })
    );

    if (!config.ignoreWarnings) config.ignoreWarnings = [];
    config.ignoreWarnings.push(/Failed to parse source map/);

    return config;
  },
};

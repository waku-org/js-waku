const webpack = require("webpack");

module.exports = {
  dev: (config) => {
    // Override webpack 5 config from react-scripts to load polyfills
    if (!config.resolve) config.resolve = {};
    if (!config.resolve.fallback) config.resolve.fallback = {};
    Object.assign(config.resolve.fallback, {
      assert: require.resolve("assert"),
      buffer: require.resolve("buffer"),
      crypto: false,
      http: require.resolve("http-browserify"),
      https: require.resolve("https-browserify"),
      stream: require.resolve("stream-browserify"),
      url: require.resolve("url"),
      zlib: require.resolve("browserify-zlib"),
    });

    if (!config.plugins) config.plugins = [];
    config.plugins.push(
      new webpack.DefinePlugin({
        "process.env.ENV": JSON.stringify("dev"),
      })
    );
    config.plugins.push(
      new webpack.ProvidePlugin({
        process: "process/browser.js",
        Buffer: ["buffer", "Buffer"],
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
      assert: require.resolve("assert"),
      buffer: require.resolve("buffer"),
      crypto: false,
      http: require.resolve("http-browserify"),
      https: require.resolve("https-browserify"),
      stream: require.resolve("stream-browserify"),
      url: require.resolve("url"),
      zlib: require.resolve("browserify-zlib"),
    });

    if (!config.plugins) config.plugins = [];
    config.plugins.push(
      new webpack.DefinePlugin({
        "process.env.ENV": JSON.stringify("prod"),
      })
    );
    config.plugins.push(
      new webpack.ProvidePlugin({
        process: "process/browser.js",
        Buffer: ["buffer", "Buffer"],
      })
    );

    if (!config.ignoreWarnings) config.ignoreWarnings = [];
    config.ignoreWarnings.push(/Failed to parse source map/);

    return config;
  },
};

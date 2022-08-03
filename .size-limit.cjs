const modifyWebpackConfig = (webpackConfig) => {
  if (!webpackConfig.resolve) webpackConfig.resolve = {};
  if (!webpackConfig.resolve.fallback) webpackConfig.resolve.fallback = {};
  // Can be removed once https://github.com/libp2p/js-libp2p-pubsub/pull/92 is merged and released
  webpackConfig.resolve.fallback.buffer = false;
  return webpackConfig;
};

module.exports = [
  {
    name: "Waku core",
    path: "dist/bundle.min.js",
    import: "{ Waku }",
    modifyWebpackConfig,
  },
  {
    name: "Waku default setup",
    path: "dist/bundle.min.js",
    import: "{ createWaku, waitForRemotePeer }",
    modifyWebpackConfig,
  },
  {
    name: "Asymmetric, symmetric encryption and signature",
    path: "dist/bundle.min.js",
    import: "{ waku_message }",
    modifyWebpackConfig,
  },
  {
    name: "DNS discovery",
    path: "dist/bundle.min.js",
    import: "{ discovery }",
    modifyWebpackConfig,
  },
  {
    name: "Privacy preserving protocols",
    path: "dist/bundle.min.js",
    import: "{ WakuRelay }",
    modifyWebpackConfig,
  },
  {
    name: "Light protocols",
    path: "dist/bundle.min.js",
    import: "{ WakuLightPush, WakuFilter }",
    modifyWebpackConfig,
  },
  {
    name: "History retrieval protocols",
    path: "dist/bundle.min.js",
    import: "{ WakuStore }",
    modifyWebpackConfig,
  },
];

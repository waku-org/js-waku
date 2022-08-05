module.exports = [
  {
    name: "Waku core",
    path: "dist/bundle.min.js",
    import: "{ Waku }",
  },
  {
    name: "Waku default setup",
    path: "dist/bundle.min.js",
    import: "{ createWaku, waitForRemotePeer }",
  },
  {
    name: "Asymmetric, symmetric encryption and signature",
    path: "dist/bundle.min.js",
    import: "{ waku_message }",
  },
  {
    name: "DNS discovery",
    path: "dist/bundle.min.js",
    import: "{ discovery }",
  },
  {
    name: "Privacy preserving protocols",
    path: "dist/bundle.min.js",
    import: "{ WakuRelay }",
  },
  {
    name: "Light protocols",
    path: "dist/bundle.min.js",
    import: "{ WakuLightPush, WakuFilter }",
  },
  {
    name: "History retrieval protocols",
    path: "dist/bundle.min.js",
    import: "{ WakuStore }",
  },
];

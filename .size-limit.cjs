module.exports = [
  {
    name: "Waku core",
    path: "bundle/index.js",
    import: "{ Waku }",
  },
  {
    name: "Waku default setup",
    path: ["bundle/index.js", "bundle/lib/create_waku.js"],
    import: {
      "./bundle/lib/create_waku.js": "{ createWaku }",
      "./bundle/index.js": "{ waitForRemotePeer }",
    },
  },
  {
    name: "Asymmetric, symmetric encryption and signature",
    path: "bundle/index.js",
    import: "{ WakuMessage }",
  },
  {
    name: "DNS discovery",
    path: "bundle/lib/peer_discovery_dns.js",
    import: "{ PeerDiscoveryDns }",
  },
  {
    name: "Privacy preserving protocols",
    path: "bundle/index.js",
    import: "{ WakuRelay }",
  },
  {
    name: "Light protocols",
    path: "bundle/index.js",
    import: "{ WakuLightPush, WakuFilter }",
  },
  {
    name: "History retrieval protocols",
    path: "bundle/index.js",
    import: "{ WakuStore }",
  },
];

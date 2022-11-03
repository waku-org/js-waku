module.exports = [
  {
    name: "Waku core",
    path: "packages/core/bundle/index.js",
    import: "{ WakuNode }",
  },
  {
    name: "Waku default setup",
    path: [
      "packages/create/bundle/index.js",
      "packages/core/bundle/lib/wait_for_remote_peer.js"
    ],
    import: {
      "./packages/create/bundle/index.js": "{ createLightNode }",
      "./packages/core/bundle/lib/wait_for_remote_peer.js":
        "{ waitForRemotePeer }",
      "./packages/core/bundle/lib/waku_message/version_0.js":
        "{ MessageV0, DecoderV0, EncoderV0 }",
    },
  },
  {
    name: "Asymmetric, symmetric encryption and signature",
    path: "packages/core/bundle/lib/waku_message/version_1.js",
    import: "{ MessageV1, AsymEncoder, AsymDecoder, SymEncoder, SymDecoder }",
  },
  {
    name: "DNS discovery",
    path: "packages/dns-discovery/bundle/index.js",
    import: "{ PeerDiscoveryDns }",
  },
  {
    name: "Privacy preserving protocols",
    path: "packages/core/bundle/index.js",
    import: "{ WakuRelay }",
  },
  {
    name: "Light protocols",
    path: "packages/core/bundle/index.js",
    import: "{ WakuLightPush, WakuFilter }",
  },
  {
    name: "History retrieval protocols",
    path: "packages/core/bundle/index.js",
    import: "{ WakuStore }",
  },
];

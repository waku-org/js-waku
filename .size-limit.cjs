module.exports = [
  {
    name: "Waku core",
    path: "bundle/index.js",
    import: "{ WakuNode }",
  },
  {
    name: "Waku default setup",
    path: ["bundle/index.js", "bundle/lib/create_waku.js"],
    import: {
      "./bundle/lib/create_waku.js": "{ createLightNode }",
      "./bundle/lib/wait_for_remote_peer.js": "{ waitForRemotePeer }",
      "./bundle/lib/waku_message/version_0.js":
        "{ MessageV0, DecoderV0, EncoderV0 }",
    },
  },
  {
    name: "Asymmetric, symmetric encryption and signature",
    path: "bundle/lib/waku_message/version_1.js",
    import: "{ MessageV1, AsymEncoder, AsymDecoder, SymEncoder, SymDecoder }",
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

module.exports = [
  {
    name: "Waku core",
    path: "packages/core/bundle/index.js",
    import: "{ WakuNode }",
  },
  {
    name: "Waku default setup",
    path: ["packages/sdk/bundle/index.js", "packages/core/bundle/index.js"],
    import: {
      "packages/sdk/bundle/index.js": "{ createLightNode }",
      "packages/core/bundle/index.js":
        "{ waitForRemotePeer, createEncoder, createDecoder }",
    },
  },
  {
    name: "ECIES encryption",
    path: "packages/message-encryption/bundle/ecies.js",
    import: "{ generatePrivateKey, createEncoder, createDecoder }",
  },
  {
    name: "Symmetric encryption",
    path: "packages/message-encryption/bundle/symmetric.js",
    import: "{ generateSymmetricKey, createEncoder, createDecoder }",
  },
  {
    name: "DNS discovery",
    path: "packages/dns-discovery/bundle/index.js",
    import: "{ PeerDiscoveryDns }",
  },
  {
    name: "Privacy preserving protocols",
    path: "packages/relay/bundle/index.js",
    import: "{ wakuRelay }",
  },
  {
    name: "Light protocols",
    path: "packages/core/bundle/index.js",
    import: "{ wakuLightPush, wakuFilterV1, wakuFilterV2 }",
  },
  {
    name: "History retrieval protocols",
    path: "packages/core/bundle/index.js",
    import: "{ wakuStore }",
  },
  {
    name: "Deterministic Message Hashing",
    path: "packages/message-hash/bundle/index.js",
    import: "{ messageHash }",
  },
];

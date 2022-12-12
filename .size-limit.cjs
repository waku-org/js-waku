module.exports = [
  {
    name: "Waku core",
    path: "packages/core/bundle/index.js",
    import: "{ WakuNode }",
  },
  {
    name: "Waku default setup",
    path: "packages/create/bundle/index.js",
    import:
      "{ createLightNode, waitForRemotePeer, createEncoder, createDecoder }",
  },
  {
    name: "ECIES encryption",
    path: "packages/message-encryption/bundle/ecies.js",
    import:
      "{ generatePrivateKey, createEncoder, createDecoder, DecodedMessage }",
  },
  {
    name: "Symmetric encryption",
    path: "packages/message-encryption/bundle/symmetric.js",
    import:
      "{ generateSymmetricKey, createEncoder,  createDecoder, DecodedMessage }",
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

module.exports = [
  {
    name: "Waku node",
    path: "packages/sdk/bundle/index.js",
    import: "{ WakuNode }",
  },
  {
    name: "Waku Simple Light Node",
    path: ["packages/sdk/bundle/index.js", "packages/core/bundle/index.js"],
    import: {
      "packages/sdk/bundle/index.js":
        "{ createLightNode, waitForRemotePeer, createEncoder, createDecoder, bytesToUtf8, utf8ToBytes, Decoder, Encoder, DecodedMessage, WakuNode  }",
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
    path: "packages/discovery/bundle/index.js",
    import: "{ PeerDiscoveryDns }",
  },
  {
    name: "Peer Exchange discovery",
    path: "packages/discovery/bundle/index.js",
    import: "{ wakuPeerExchangeDiscovery }",
  },
  {
    name: "Local Peer Cache Discovery",
    path: "packages/discovery/bundle/index.js",
    import: "{ wakuLocalPeerCacheDiscovery }",
  },
  {
    name: "Privacy preserving protocols",
    path: "packages/relay/bundle/index.js",
    import: "{ wakuRelay }",
  },
  {
    name: "Waku Filter",
    path: "packages/sdk/bundle/index.js",
    import: "{ wakuFilter }",
  },
  {
    name: "Waku LightPush",
    path: "packages/sdk/bundle/index.js",
    import: "{ wakuLightPush }",
  },
  {
    name: "History retrieval protocols",
    path: "packages/sdk/bundle/index.js",
    import: "{ wakuStore }",
  },
  {
    name: "Deterministic Message Hashing",
    path: "packages/message-hash/bundle/index.js",
    import: "{ messageHash }",
  },
];

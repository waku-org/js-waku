export const NETWORK_CONFIG = {
  "waku.sandbox": {
    peers: [
      "/dns4/node-01.do-ams3.waku.sandbox.status.im/tcp/30303/p2p/16Uiu2HAmNaeL4p3WEYzC9mgXBmBWSgWjPHRvatZTXnp8Jgv3iKsb",
      "/dns4/node-01.gc-us-central1-a.waku.sandbox.status.im/tcp/30303/p2p/16Uiu2HAmRv1iQ3NoMMcjbtRmKxPuYBbF9nLYz2SDv9MTN8WhGuUU",
      "/dns4/node-01.ac-cn-hongkong-c.waku.sandbox.status.im/tcp/30303/p2p/16Uiu2HAmQYiojgZ8APsh9wqbWNyCstVhnp9gbeNrxSEQnLJchC92"
    ]
  },

  "waku.test": {
    peers: [
      "/dns4/node-01.do-ams3.waku.test.status.im/tcp/8000/wss/p2p/16Uiu2HAkykgaECHswi3YKJ5dMLbq2kPVCo89fcyTd38UcQD6ej5W",
      "/dns4/node-01.gc-us-central1-a.waku.test.status.im/tcp/8000/wss/p2p/16Uiu2HAmDCp8XJ9z1ev18zuv8NHekAsjNyezAvmMfFEJkiharitG",
      "/dns4/node-01.ac-cn-hongkong-c.waku.test.status.im/tcp/8000/wss/p2p/16Uiu2HAkzHaTP5JsUwfR9NR8Rj9HC24puS6ocaU8wze4QrXr9iXp"
    ]
  },

  networkConfig: {
    clusterId: 1,
    shards: [0]
  },

  // Default node configuration
  defaultNodeConfig: {
    defaultBootstrap: false
  },

  // Test message configuration
  testMessage: {
    contentTopic: "/test/1/message/proto",
    payload: "Hello, Waku!"
  }
};

export const ACTIVE_PEERS = NETWORK_CONFIG["waku.test"].peers;
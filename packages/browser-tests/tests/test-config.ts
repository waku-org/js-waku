export const NETWORK_CONFIG = {
  cluster42: {
    networkConfig: {
      clusterId: 42,
      shards: [0]
    },
    peers: [
      "/dns4/waku-test.bloxy.one/tcp/8095/wss/p2p/16Uiu2HAmSZbDB7CusdRhgkD81VssRjQV5ZH13FbzCGcdnbbh6VwZ",
      "/dns4/waku.fryorcraken.xyz/tcp/8000/wss/p2p/16Uiu2HAmMRvhDHrtiHft1FTUYnn6cVA8AWVrTyLUayJJ3MWpUZDB",
      "/dns4/ivansete.xyz/tcp/8000/wss/p2p/16Uiu2HAmDAHuJ8w9zgxVnhtFe8otWNJdCewPAerJJPbXJcn8tu4r"
    ]
  },

  sandbox: {
    networkConfig: {
      clusterId: 1,
      shards: [0]
    },
    peers: [
      "/dns4/node-01.do-ams3.waku.sandbox.status.im/tcp/30303/p2p/16Uiu2HAmNaeL4p3WEYzC9mgXBmBWSgWjPHRvatZTXnp8Jgv3iKsb",
      "/dns4/node-01.gc-us-central1-a.waku.sandbox.status.im/tcp/30303/p2p/16Uiu2HAmRv1iQ3NoMMcjbtRmKxPuYBbF9nLYz2SDv9MTN8WhGuUU",
      "/dns4/node-01.ac-cn-hongkong-c.waku.sandbox.status.im/tcp/30303/p2p/16Uiu2HAmQYiojgZ8APsh9wqbWNyCstVhnp9gbeNrxSEQnLJchC92"
    ]
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

// Active environment - change this to switch between cluster42 and sandbox
export const ACTIVE_ENV = 'cluster42';
export const ACTIVE_PEERS = NETWORK_CONFIG[ACTIVE_ENV].peers;
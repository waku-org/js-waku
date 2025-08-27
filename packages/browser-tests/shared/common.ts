export interface IWakuNode {
  libp2p: {
    peerId: { toString(): string };
    getMultiaddrs(): Array<{ toString(): string }>;
    getProtocols(): any;
    peerStore: {
      all(): Promise<Array<{ id: { toString(): string } }>>;
    };
  };
  lightPush: {
    // eslint-disable-next-line no-unused-vars
    send: (encoder: any, message: { payload: Uint8Array }) => Promise<{ successes: any[] }>;
  };
}

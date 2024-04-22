import { IBaseProtocolSDK } from "@waku/interfaces";

interface Options {
  numPeersToUse?: number;
}

const DEFAULT_NUM_PEERS_TO_USE = 3;

export class BaseProtocolSDK implements IBaseProtocolSDK {
  public readonly numPeers: number;

  constructor(options: Options) {
    this.numPeers = options?.numPeersToUse ?? DEFAULT_NUM_PEERS_TO_USE;
  }
}

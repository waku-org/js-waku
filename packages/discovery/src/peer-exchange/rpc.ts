import { protoPeerExchange as proto } from "@waku/proto";
import type { Uint8ArrayList } from "uint8arraylist";

/**
 * PeerExchangeRPC represents a message conforming to the Waku Peer Exchange protocol
 */
export class PeerExchangeRPC {
  public constructor(public proto: proto.PeerExchangeRPC) {}

  static createRequest(params: proto.PeerExchangeQuery): PeerExchangeRPC {
    const { numPeers } = params;
    return new PeerExchangeRPC({
      query: {
        numPeers: numPeers
      },
      response: undefined
    });
  }

  /**
   * Encode the current PeerExchangeRPC request to bytes
   * @returns Uint8Array
   */
  encode(): Uint8Array {
    return proto.PeerExchangeRPC.encode(this.proto);
  }

  /**
   * Decode the current PeerExchangeRPC request to bytes
   * @returns Uint8Array
   */
  static decode(bytes: Uint8ArrayList): PeerExchangeRPC {
    const res = proto.PeerExchangeRPC.decode(bytes);
    return new PeerExchangeRPC(res);
  }

  get query(): proto.PeerExchangeQuery | undefined {
    return this.proto.query;
  }

  get response(): proto.PeerExchangeResponse | undefined {
    return this.proto.response;
  }
}

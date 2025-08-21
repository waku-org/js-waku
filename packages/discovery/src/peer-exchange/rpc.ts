import { proto_peer_exchange as proto } from "@waku/proto";
import type { Uint8ArrayList } from "uint8arraylist";

/**
 * PeerExchangeRPC represents a message conforming to the Waku Peer Exchange protocol
 */
export class PeerExchangeRPC {
  public constructor(public proto: proto.PeerExchangeRPC) {}

  public static createRequest(
    params: proto.PeerExchangeQuery
  ): PeerExchangeRPC {
    const { numPeers } = params;
    return new PeerExchangeRPC({
      query: {
        numPeers: numPeers
      },
      response: undefined
    });
  }

  /**
   * Decode the current PeerExchangeRPC request to bytes
   * @returns Uint8Array
   */
  public static decode(bytes: Uint8ArrayList): PeerExchangeRPC {
    const res = proto.PeerExchangeRPC.decode(bytes);
    return new PeerExchangeRPC(res);
  }

  /**
   * Encode the current PeerExchangeRPC request to bytes
   * @returns Uint8Array
   */
  public encode(): Uint8Array {
    return proto.PeerExchangeRPC.encode(this.proto);
  }

  public get query(): proto.PeerExchangeQuery | undefined {
    return this.proto.query;
  }

  public get response(): proto.PeerExchangeResponse | undefined {
    return this.proto.response;
  }
}

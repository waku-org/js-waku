import { PeerExchangeQueryParams } from "@waku/interfaces";
import { proto_peer_exchange as proto } from "@waku/proto";
import type { Uint8ArrayList } from "uint8arraylist";

/**
 * PeerExchangeRPC represents a message conforming to the Waku Peer Exchange protocol
 */
export class PeerExchangeRPC {
  public constructor(public proto: proto.PeerExchangeRPC) {}

  static createRequest(params: PeerExchangeQueryParams): proto.PeerExchangeRPC {
    const { numPeers } = params;

    const query = new proto.PeerExchangeQuery({
      numPeers: BigInt(numPeers),
    });
    return new proto.PeerExchangeRPC({
      query,
    });
  }

  /**
   * Encode the current PeerExchangeRPC request to bytes
   * @returns Uint8Array
   */
  encode(): Uint8Array {
    return new proto.PeerExchangeRPC(this.proto).toBinary();
  }

  /**
   * Decode the current PeerExchangeRPC request to bytes
   * @returns Uint8Array
   */
  static decode(bytes: Uint8ArrayList): PeerExchangeRPC {
    const uint8array = bytes.slice();
    const res = proto.PeerExchangeRPC.fromBinary(uint8array);
    return new PeerExchangeRPC(res);
  }

  get query(): proto.PeerExchangeQuery | undefined {
    return this.proto.query;
  }

  get response(): proto.PeerExchangeResponse | undefined {
    return this.proto.response;
  }
}

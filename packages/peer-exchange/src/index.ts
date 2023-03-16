import type { PeerExchangeQueryParams } from "@waku/interfaces";
import { proto_peer_exchange as proto } from "@waku/proto";

export function createRequest(
  params: PeerExchangeQueryParams
): proto.PeerExchangeRPC {
  const { numPeers } = params;

  const query = new proto.PeerExchangeQuery({
    numPeers: BigInt(numPeers),
  });
  return new proto.PeerExchangeRPC({
    query,
  });
}

export {
  wakuPeerExchange,
  PeerExchangeCodec,
  WakuPeerExchange,
} from "./waku_peer_exchange.js";
export {
  wakuPeerExchangeDiscovery,
  PeerExchangeDiscovery,
  Options,
  DEFAULT_PEER_EXCHANGE_TAG_NAME,
} from "./waku_peer_exchange_discovery.js";

import { Tags } from "@waku/interfaces";

// amount of peers available per specification
export const DEFAULT_PEER_EXCHANGE_REQUEST_NODES = 60;

export const DEFAULT_PEER_EXCHANGE_TAG_NAME = Tags.PEER_EXCHANGE;
export const DEFAULT_PEER_EXCHANGE_TAG_VALUE = 50;
export const DEFAULT_PEER_EXCHANGE_TAG_TTL = 30_000;

export const PeerExchangeCodec = "/vac/waku/peer-exchange/2.0.0-alpha1";

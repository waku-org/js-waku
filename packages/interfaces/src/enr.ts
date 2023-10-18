import type { PeerId } from "@libp2p/interface/peer-id";
import type { PeerInfo } from "@libp2p/interface/peer-info";
import type { Multiaddr } from "@multiformats/multiaddr";

export type ENRKey = string;
export type ENRValue = Uint8Array;
/**
 * We represent NodeId as a hex string, since node equality is used very heavily
 * and it is convenient to index data by NodeId
 */
export type NodeId = string;
export type SequenceNumber = bigint;

export interface Waku2 {
  relay: boolean;
  store: boolean;
  filter: boolean;
  lightPush: boolean;
}

export interface ShardInfo {
  cluster: number;
  indexList: number[];
}

export interface IEnr extends Map<ENRKey, ENRValue> {
  nodeId?: NodeId;
  peerId?: PeerId;
  id: string;
  seq: SequenceNumber;
  publicKey?: Uint8Array;
  signature?: Uint8Array;
  ip?: string;
  tcp?: number;
  udp?: number;
  ip6?: string;
  tcp6?: number;
  udp6?: number;
  multiaddrs?: Multiaddr[];
  waku2?: Waku2;
  peerInfo: PeerInfo | undefined;
  shardInfo?: ShardInfo;

  /**
   * @deprecated: use { @link IEnr.peerInfo } instead.
   */
  getFullMultiaddrs(): Multiaddr[];
}

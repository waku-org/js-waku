import type { PeerId } from "@libp2p/interface/peer-id";

import type { ShardInfo } from "./enr.js";
import type { IBaseProtocol } from "./protocols.js";

// IMetadata always has shardInfo defined while it is optionally undefined in IBaseProtocol
export interface IMetadata extends Omit<IBaseProtocol, "shardInfo"> {
  shardInfo: ShardInfo;
  handshakesConfirmed: PeerId[];
  query(peerId: PeerId): Promise<ShardInfo | undefined>;
}

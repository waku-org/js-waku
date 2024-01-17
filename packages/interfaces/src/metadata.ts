import type { PeerId } from "@libp2p/interface";

import type { ShardInfo } from "./enr.js";
import type { IBaseProtocol } from "./protocols.js";

export interface IMetadata extends IBaseProtocol {
  query(peerId: PeerId): Promise<ShardInfo | undefined>;
}

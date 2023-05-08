import { PeerId } from "@libp2p/interface-peer-id";

import type { PointToPointProtocol } from "./protocols.js";
import { IReceiver } from "./receiver.js";

export type IFilterV1 = IReceiver<"v1"> & PointToPointProtocol;
export type IFilterV2 = IReceiver<"v2"> & {
  ping: (peerId: PeerId) => Promise<void>;
} & PointToPointProtocol;

import type { PointToPointProtocol } from "./protocols.js";
import type { IReceiverV1, IReceiverV2 } from "./receiver.js";

export type IFilterV1 = IReceiverV1 & PointToPointProtocol;
export type IFilterV2 = IReceiverV2 & PointToPointProtocol;

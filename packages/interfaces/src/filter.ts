import type { PointToPointProtocol } from "./protocols.js";
import type { IReceiver } from "./receiver.js";

export type IFilter = IReceiver & PointToPointProtocol;

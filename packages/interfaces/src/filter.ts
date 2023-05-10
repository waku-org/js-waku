import type { PointToPointProtocol } from "./protocols.js";
import { IReceiver } from "./receiver.js";

export type ContentFilter = {
  contentTopic: string;
};

export type IFilterV1 = IReceiver<"v1"> & PointToPointProtocol;
export type IFilterV2 = IReceiver<"v2"> & PointToPointProtocol;

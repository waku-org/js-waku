import type { PointToPointProtocol } from "./protocols.js";
import type { IReceiver } from "./receiver.js";

export type ContentFilter = {
  contentTopic: string;
};

export type IFilter = IReceiver & PointToPointProtocol;

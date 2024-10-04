import { IBaseProtocolCore, IBaseProtocolSDK } from "./protocols.js";
import type { ISender } from "./sender.js";

export type ILightPush = ISender &
  IBaseProtocolSDK & { protocol: IBaseProtocolCore };

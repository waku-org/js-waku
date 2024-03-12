import { IBaseProtocolCore, IBaseProtocolSDK } from "./protocols.js";
import type { ISender } from "./sender.js";

export type ILightPushSDK = ISender &
  IBaseProtocolSDK & { protocol: IBaseProtocolCore };

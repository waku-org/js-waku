import type { ISender, ISendOptions } from "./sender.js";

export type LightPushProtocolOptions = ISendOptions & {
  /**
   * The interval in milliseconds to wait before retrying a failed push.
   * @default 1000
   */
  retryIntervalMs: number;

  /**
   * Number of peers to send message to.
   *
   * @default 1
   */
  numPeersToUse?: number;
};

export type ILightPush = ISender & {
  readonly multicodec: string;
  start: () => void;
  stop: () => void;
};

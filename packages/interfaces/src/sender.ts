import type { IEncoder, IMessage } from "./message.js";
import { LightPushSDKResult } from "./protocols.js";

export type ISendOptions = {
  /**
   * Enables retry of a message that was failed to be sent.
   * @default true
   */
  autoRetry?: boolean;

  /**
   * Sets number of attempts if `autoRetry` is enabled.
   * @default 3
   */
  maxAttempts?: number;

  /**
   * Use v2 of the light push protocol.
   * This parameter will be removed in the future.
   * @default false
   */
  useLegacy?: boolean;

  /**
   * Amount of peers to send message to.
   * Overrides `numPeersToUse` in {@link @waku/interfaces!CreateNodeOptions}.
   */
  numPeersToUse?: number;
};

export interface ISender {
  send: (
    encoder: IEncoder,
    message: IMessage,
    sendOptions?: ISendOptions
  ) => Promise<LightPushSDKResult>;
}

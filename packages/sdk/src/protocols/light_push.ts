import type { PeerId } from "@libp2p/interface";
import { LightPushCore } from "@waku/core";
import {
  Failure,
  type IEncoder,
  ILightPushSDK,
  type IMessage,
  type Libp2p,
  type ProtocolCreateOptions,
  SendError,
  type SendResult
} from "@waku/interfaces";
import { Logger } from "@waku/utils";

import { BaseProtocolSDK } from "./base_protocol.js";

const DEFAULT_NUM_PEERS = 3;
const log = new Logger("sdk:light-push");

export class LightPushSDK extends BaseProtocolSDK implements ILightPushSDK {
  public readonly protocol: LightPushCore;

  constructor(libp2p: Libp2p, options?: ProtocolCreateOptions) {
    super({ numPeersToUse: options?.numPeersToUse ?? DEFAULT_NUM_PEERS });
    this.protocol = new LightPushCore(libp2p, options);
  }

  async send(encoder: IEncoder, message: IMessage): Promise<SendResult> {
    const successes: PeerId[] = [];
    const failures: Failure[] = [];

    const peers = await this.protocol.getPeers();
    if (!peers.length) {
      return {
        successes,
        failures: [{ error: SendError.NO_PEER_AVAILABLE }]
      };
    }

    const sendPromises = peers.map((peer) =>
      this.protocol.send(encoder, message, peer)
    );

    const results = await Promise.allSettled(sendPromises);

    for (const result of results) {
      if (result.status === "fulfilled") {
        const { failure, success } = result.value;
        if (success) {
          successes.push(success);
        }
        if (failure) {
          failures.push(failure);
        }
      } else {
        log.error("Failed to send message to peer", result.reason);
        failures.push({ error: SendError.GENERIC_FAIL });
        // TODO: handle renewing faulty peers with new peers (https://github.com/waku-org/js-waku/issues/1463)
      }
    }

    return {
      successes,
      failures
    };
  }
}

export function wakuLightPush(
  init: Partial<ProtocolCreateOptions> = {}
): (libp2p: Libp2p) => ILightPushSDK {
  return (libp2p: Libp2p) => new LightPushSDK(libp2p, init);
}

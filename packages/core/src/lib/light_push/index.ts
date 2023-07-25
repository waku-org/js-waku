import type { PeerId } from "@libp2p/interface-peer-id";
import {
  IEncoder,
  ILightPush,
  IMessage,
  Libp2p,
  ProtocolCreateOptions,
  ProtocolOptions,
  SendError,
  SendResult,
} from "@waku/interfaces";
import { PushResponse } from "@waku/proto";
import { isSizeValid } from "@waku/utils";
import debug from "debug";
import all from "it-all";
import * as lp from "it-length-prefixed";
import { pipe } from "it-pipe";
import { Uint8ArrayList } from "uint8arraylist";

import { BaseProtocol } from "../base_protocol.js";
import { DefaultPubSubTopic } from "../constants.js";

import { PushRpc } from "./push_rpc.js";

const log = debug("waku:light-push");

export const LightPushCodec = "/vac/waku/lightpush/2.0.0-beta1";
export { PushResponse };

/**
 * Implements the [Waku v2 Light Push protocol](https://rfc.vac.dev/spec/19/).
 */
class LightPush extends BaseProtocol implements ILightPush {
  options: ProtocolCreateOptions;

  constructor(libp2p: Libp2p, options?: ProtocolCreateOptions) {
    super(LightPushCodec, libp2p.components);
    this.options = options || {};
  }

  async send(
    encoder: IEncoder,
    message: IMessage,
    opts?: ProtocolOptions
  ): Promise<SendResult> {
    const { pubSubTopic = DefaultPubSubTopic } = this.options;

    const peer = await this.getPeer(opts?.peerId);
    const stream = await this.newStream(peer);

    const recipients: PeerId[] = [];
    let error: undefined | SendError = undefined;

    try {
      if (!isSizeValid(message.payload)) {
        log("Failed to send waku light push: message is bigger that 1MB");
        return {
          recipients,
          error: SendError.SIZE_TOO_BIG,
        };
      }

      const protoMessage = await encoder.toProtoObj(message);
      if (!protoMessage) {
        log("Failed to encode to protoMessage, aborting push");
        return {
          recipients,
          error: SendError.ENCODE_FAILED,
        };
      }
      const query = PushRpc.createRequest(protoMessage, pubSubTopic);
      const res = await pipe(
        [query.encode()],
        lp.encode,
        stream,
        lp.decode,
        async (source) => await all(source)
      );
      try {
        const bytes = new Uint8ArrayList();
        res.forEach((chunk) => {
          bytes.append(chunk);
        });

        const response = PushRpc.decode(bytes).response;

        if (response?.isSuccess) {
          recipients.push(peer.id);
        } else {
          log("No response in PushRPC");
          error = SendError.NO_RPC_RESPONSE;
        }
      } catch (err) {
        log("Failed to decode push reply", err);
        error = SendError.DECODE_FAILED;
      }
    } catch (err) {
      log("Failed to send waku light push request", err);
      error = SendError.GENERIC_FAIL;
    }
    return {
      error,
      recipients,
    };
  }
}

export function wakuLightPush(
  init: Partial<ProtocolCreateOptions> = {}
): (libp2p: Libp2p) => ILightPush {
  return (libp2p: Libp2p) => new LightPush(libp2p, init);
}

import type { PeerId, Stream } from "@libp2p/interface";
import {
  IEncoder,
  ILightPush,
  IMessage,
  Libp2p,
  ProtocolCreateOptions,
  SendError,
  SendResult
} from "@waku/interfaces";
import { PushResponse } from "@waku/proto";
import {
  ensurePubsubTopicIsConfigured,
  isMessageSizeUnderCap
} from "@waku/utils";
import { Logger } from "@waku/utils";
import all from "it-all";
import * as lp from "it-length-prefixed";
import { pipe } from "it-pipe";
import { Uint8ArrayList } from "uint8arraylist";

import { BaseProtocol } from "../base_protocol.js";

import { PushRpc } from "./push_rpc.js";

const log = new Logger("light-push");

export const LightPushCodec = "/vac/waku/lightpush/2.0.0-beta1";
export { PushResponse };

type PreparePushMessageResult =
  | {
      query: PushRpc;
      error: null;
    }
  | {
      query: null;
      error: SendError;
    };

/**
 * Implements the [Waku v2 Light Push protocol](https://rfc.vac.dev/spec/19/).
 */
class LightPush extends BaseProtocol implements ILightPush {
  constructor(libp2p: Libp2p, options?: ProtocolCreateOptions) {
    super(LightPushCodec, libp2p.components, log, options);
  }

  private async preparePushMessage(
    encoder: IEncoder,
    message: IMessage,
    pubsubTopic: string
  ): Promise<PreparePushMessageResult> {
    try {
      if (!message.payload || message.payload.length === 0) {
        log.error("Failed to send waku light push: payload is empty");
        return { query: null, error: SendError.EMPTY_PAYLOAD };
      }

      if (!(await isMessageSizeUnderCap(encoder, message))) {
        log.error("Failed to send waku light push: message is bigger than 1MB");
        return { query: null, error: SendError.SIZE_TOO_BIG };
      }

      const protoMessage = await encoder.toProtoObj(message);
      if (!protoMessage) {
        log.error("Failed to encode to protoMessage, aborting push");
        return {
          query: null,
          error: SendError.ENCODE_FAILED
        };
      }

      const query = PushRpc.createRequest(protoMessage, pubsubTopic);
      return { query, error: null };
    } catch (error) {
      log.error("Failed to prepare push message", error);

      return {
        query: null,
        error: SendError.GENERIC_FAIL
      };
    }
  }

  async send(encoder: IEncoder, message: IMessage): Promise<SendResult> {
    const { pubsubTopic } = encoder;
    ensurePubsubTopicIsConfigured(pubsubTopic, this.pubsubTopics);

    const recipients: PeerId[] = [];

    const { query, error: preparationError } = await this.preparePushMessage(
      encoder,
      message,
      pubsubTopic
    );

    if (preparationError || !query) {
      return {
        recipients,
        errors: [preparationError]
      };
    }

    const peers = await this.getPeers({
      maxBootstrapPeers: 1,
      numPeers: this.numPeersTouse
    });

    if (!peers.length) {
      return {
        recipients,
        errors: [SendError.NO_PEER_AVAILABLE]
      };
    }

    const promises = peers.map(async (peer) => {
      let stream: Stream | undefined;
      try {
        stream = await this.getStream(peer);
      } catch (err) {
        log.error(
          `Failed to get a stream for remote peer${peer.id.toString()}`,
          err
        );
        return { recipients, error: SendError.REMOTE_PEER_FAULT };
      }

      let res: Uint8ArrayList[] | undefined;
      try {
        res = await pipe(
          [query.encode()],
          lp.encode,
          stream,
          lp.decode,
          async (source) => await all(source)
        );
      } catch (err) {
        log.error("Failed to send waku light push request", err);
        return { recipients, error: SendError.GENERIC_FAIL };
      }

      const bytes = new Uint8ArrayList();
      res.forEach((chunk) => {
        bytes.append(chunk);
      });

      let response: PushResponse | undefined;
      try {
        response = PushRpc.decode(bytes).response;
      } catch (err) {
        log.error("Failed to decode push reply", err);
        return { recipients, error: SendError.DECODE_FAILED };
      }

      if (!response) {
        log.error("Remote peer fault: No response in PushRPC");
        return { recipients, error: SendError.REMOTE_PEER_FAULT };
      }

      if (!response.isSuccess) {
        log.error("Remote peer rejected the message: ", response.info);
        return { recipients, error: SendError.REMOTE_PEER_REJECTED };
      }

      recipients.some((recipient) => recipient.equals(peer.id)) ||
        recipients.push(peer.id);

      return { recipients };
    });

    const results = await Promise.allSettled(promises);

    // TODO: handle renewing faulty peers with new peers (https://github.com/waku-org/js-waku/issues/1463)
    const errors = results
      .filter(
        (
          result
        ): result is PromiseFulfilledResult<{
          recipients: PeerId[];
          error: SendError | undefined;
        }> => result.status === "fulfilled"
      )
      .map((result) => result.value.error)
      .filter((error) => error !== undefined) as SendError[];

    return {
      recipients,
      errors
    };
  }
}

export function wakuLightPush(
  init: Partial<ProtocolCreateOptions> = {}
): (libp2p: Libp2p) => ILightPush {
  return (libp2p: Libp2p) => new LightPush(libp2p, init);
}

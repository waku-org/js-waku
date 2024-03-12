import type { Peer, PeerId, Stream } from "@libp2p/interface";
import {
  Failure,
  IBaseProtocolCore,
  IEncoder,
  IMessage,
  Libp2p,
  ProtocolCreateOptions,
  ProtocolError
} from "@waku/interfaces";
import { PushResponse } from "@waku/proto";
import { isMessageSizeUnderCap } from "@waku/utils";
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
      error: ProtocolError;
    };

type CoreSendResult =
  | {
      success: null;
      failure: Failure;
    }
  | {
      success: PeerId;
      failure: null;
    };

/**
 * Implements the [Waku v2 Light Push protocol](https://rfc.vac.dev/spec/19/).
 */
export class LightPushCore extends BaseProtocol implements IBaseProtocolCore {
  constructor(libp2p: Libp2p, options?: ProtocolCreateOptions) {
    super(
      LightPushCodec,
      libp2p.components,
      log,
      options!.pubsubTopics!,
      options
    );
  }

  private async preparePushMessage(
    encoder: IEncoder,
    message: IMessage
  ): Promise<PreparePushMessageResult> {
    try {
      if (!message.payload || message.payload.length === 0) {
        log.error("Failed to send waku light push: payload is empty");
        return { query: null, error: ProtocolError.EMPTY_PAYLOAD };
      }

      if (!(await isMessageSizeUnderCap(encoder, message))) {
        log.error("Failed to send waku light push: message is bigger than 1MB");
        return { query: null, error: ProtocolError.SIZE_TOO_BIG };
      }

      const protoMessage = await encoder.toProtoObj(message);
      if (!protoMessage) {
        log.error("Failed to encode to protoMessage, aborting push");
        return {
          query: null,
          error: ProtocolError.ENCODE_FAILED
        };
      }

      const query = PushRpc.createRequest(protoMessage, encoder.pubsubTopic);
      return { query, error: null };
    } catch (error) {
      log.error("Failed to prepare push message", error);

      return {
        query: null,
        error: ProtocolError.GENERIC_FAIL
      };
    }
  }

  async send(
    encoder: IEncoder,
    message: IMessage,
    peer: Peer
  ): Promise<CoreSendResult> {
    const { query, error: preparationError } = await this.preparePushMessage(
      encoder,
      message
    );

    if (preparationError || !query) {
      return {
        success: null,
        failure: {
          error: preparationError,
          peerId: peer.id
        }
      };
    }

    let stream: Stream | undefined;
    try {
      stream = await this.getStream(peer);
    } catch (err) {
      log.error(
        `Failed to get a stream for remote peer${peer.id.toString()}`,
        err
      );
      return {
        success: null,
        failure: {
          error: ProtocolError.REMOTE_PEER_FAULT,
          peerId: peer.id
        }
      };
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
      return {
        success: null,
        failure: {
          error: ProtocolError.GENERIC_FAIL,
          peerId: peer.id
        }
      };
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
      return {
        success: null,
        failure: {
          error: ProtocolError.DECODE_FAILED,
          peerId: peer.id
        }
      };
    }

    if (!response) {
      log.error("Remote peer fault: No response in PushRPC");
      return {
        success: null,
        failure: {
          error: ProtocolError.REMOTE_PEER_FAULT,
          peerId: peer.id
        }
      };
    }

    if (!response.isSuccess) {
      log.error("Remote peer rejected the message: ", response.info);
      return {
        success: null,
        failure: {
          error: ProtocolError.REMOTE_PEER_REJECTED,
          peerId: peer.id
        }
      };
    }

    return { success: peer.id, failure: null };
  }
}

import type { PeerId, Stream } from "@libp2p/interface";
import {
  type CoreProtocolResult,
  type IBaseProtocolCore,
  type IEncoder,
  type IMessage,
  isSuccessStatusCodeV3,
  type Libp2p,
  LightPushCodecV3,
  LightPushStatusCodeV3,
  ProtocolError,
  PubsubTopic,
  type ThisOrThat
} from "@waku/interfaces";
import { proto_lightpush_v3, WakuMessage } from "@waku/proto";
import { isMessageSizeUnderCap } from "@waku/utils";
import { Logger } from "@waku/utils";
import all from "it-all";
import * as lp from "it-length-prefixed";
import { pipe } from "it-pipe";
import { Uint8ArrayList } from "uint8arraylist";

import { BaseProtocol } from "../base_protocol.js";

import { PushRpcV3 } from "./push_rpc_v3.js";
import {
  getLightPushStatusDescriptionV3,
  lightPushStatusCodeToProtocolErrorV3
} from "./status_codes_v3.js";
import { isRLNResponseError } from "./utils.js";

const log = new Logger("light-push-v3");

type PreparePushMessageResult = ThisOrThat<"query", PushRpcV3>;

export class LightPushCoreV3 extends BaseProtocol implements IBaseProtocolCore {
  public constructor(
    public readonly pubsubTopics: PubsubTopic[],
    libp2p: Libp2p
  ) {
    super(LightPushCodecV3, libp2p.components, pubsubTopics);
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

      const query = PushRpcV3.createRequest(
        protoMessage as WakuMessage,
        encoder.pubsubTopic
      );
      return { query, error: null };
    } catch (error) {
      log.error("Failed to prepare push message", error);

      return {
        query: null,
        error: ProtocolError.GENERIC_FAIL
      };
    }
  }

  public async send(
    encoder: IEncoder,
    message: IMessage,
    peerId: PeerId
  ): Promise<CoreProtocolResult> {
    const { query, error: preparationError } = await this.preparePushMessage(
      encoder,
      message
    );

    if (preparationError || !query) {
      return {
        success: null,
        failure: {
          error: preparationError,
          peerId
        }
      };
    }

    let stream: Stream;
    try {
      stream = await this.getStream(peerId);
    } catch (error) {
      log.error("Failed to get stream", error);
      return {
        success: null,
        failure: {
          error: ProtocolError.NO_STREAM_AVAILABLE,
          peerId: peerId
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
          error: ProtocolError.STREAM_ABORTED,
          peerId: peerId
        }
      };
    }

    const bytes = new Uint8ArrayList();
    res.forEach((chunk) => {
      bytes.append(chunk);
    });

    let response: proto_lightpush_v3.LightpushResponse | undefined;
    try {
      response = proto_lightpush_v3.LightpushResponse.decode(bytes);
    } catch (err) {
      log.error("Failed to decode push response", err);
      return {
        success: null,
        failure: {
          error: ProtocolError.DECODE_FAILED,
          peerId: peerId
        }
      };
    }

    if (!response) {
      log.error("Remote peer fault: No response received");
      return {
        success: null,
        failure: {
          error: ProtocolError.NO_RESPONSE,
          peerId: peerId
        }
      };
    }

    // Validate request ID matches (except for rate limiting responses)
    if (response.requestId !== query.query?.requestId) {
      // nwaku sends "N/A" for rate limiting responses
      if (response.statusCode !== LightPushStatusCodeV3.TOO_MANY_REQUESTS) {
        log.error("Request ID mismatch", {
          sent: query.query?.requestId,
          received: response.requestId
        });
        return {
          success: null,
          failure: {
            error: ProtocolError.GENERIC_FAIL,
            peerId: peerId
          }
        };
      }
    }

    const statusCode = response.statusCode;
    const isSuccess = isSuccessStatusCodeV3(statusCode);

    // Special handling for nwaku rate limiting
    if (statusCode === LightPushStatusCodeV3.TOO_MANY_REQUESTS) {
      if (response.requestId === "N/A") {
        log.warn("Rate limited by nwaku node", {
          statusDesc:
            response.statusDesc || "Request rejected due to too many requests"
        });
      }
    }

    if (response.relayPeerCount !== undefined) {
      log.info(`Message relayed to ${response.relayPeerCount} peers`);
    }

    if (response.statusDesc && isRLNResponseError(response.statusDesc)) {
      log.error("Remote peer fault: RLN generation");
      return {
        success: null,
        failure: {
          error: ProtocolError.RLN_PROOF_GENERATION,
          peerId: peerId
        }
      };
    }

    if (!isSuccess) {
      const errorMessage = getLightPushStatusDescriptionV3(
        statusCode,
        response.statusDesc
      );
      log.error("Remote peer rejected the message: ", errorMessage);

      const protocolError = lightPushStatusCodeToProtocolErrorV3(statusCode);
      return {
        success: null,
        failure: {
          error: protocolError,
          peerId: peerId
        }
      };
    }

    return { success: peerId, failure: null };
  }
}

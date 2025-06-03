import type { PeerId, Stream } from "@libp2p/interface";
import {
  type CoreProtocolResultWithMeta,
  type IEncoder,
  type IMessage,
  type Libp2p,
  ProtocolError,
  PubsubTopic,
  type ThisOrThat
} from "@waku/interfaces";
import { proto_lightpush_v2, PushResponse } from "@waku/proto";
import { isMessageSizeUnderCap } from "@waku/utils";
import { Logger } from "@waku/utils";
import all from "it-all";
import * as lp from "it-length-prefixed";
import { pipe } from "it-pipe";
import { Uint8ArrayList } from "uint8arraylist";

import { StreamManager } from "../stream_manager/index.js";

import { PushRpcV2 } from "./push_rpc_v2.js";
import { mapInfoToProtocolError } from "./utils.js";

const log = new Logger("light-push");

export const LightPushCodec = "/vac/waku/lightpush/2.0.0-beta1";

export const LightPushCodecV2 = LightPushCodec;

type PreparePushMessageResult = ThisOrThat<"query", PushRpcV2>;

export class LightPushCore {
  private readonly streamManager: StreamManager;

  public readonly multicodec = LightPushCodec;

  public constructor(
    public readonly pubsubTopics: PubsubTopic[],
    libp2p: Libp2p
  ) {
    this.streamManager = new StreamManager(LightPushCodec, libp2p.components);
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

      const query = PushRpcV2.createRequest(protoMessage, encoder.pubsubTopic);
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
  ): Promise<CoreProtocolResultWithMeta> {
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
        },
        protocolUsed: LightPushCodec
      };
    }

    let stream: Stream;
    try {
      stream = await this.streamManager.getStream(peerId);
    } catch (error) {
      log.error("Failed to get stream", error);
      return {
        success: null,
        failure: {
          error: ProtocolError.NO_STREAM_AVAILABLE,
          peerId: peerId
        },
        protocolUsed: LightPushCodec
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
        },
        protocolUsed: LightPushCodec
      };
    }

    const bytes = new Uint8ArrayList();
    res.forEach((chunk) => {
      bytes.append(chunk);
    });

    let response: proto_lightpush_v2.PushResponse | undefined;
    try {
      response = PushRpcV2.decode(bytes).response;
    } catch (err) {
      log.error("Failed to decode push reply", err);
      return {
        success: null,
        failure: {
          error: ProtocolError.DECODE_FAILED,
          peerId: peerId
        },
        protocolUsed: LightPushCodec
      };
    }

    if (!response) {
      log.error("Remote peer fault: No response in PushRPC");
      return {
        success: null,
        failure: {
          error: ProtocolError.NO_RESPONSE,
          peerId: peerId
        },
        protocolUsed: LightPushCodec
      };
    }

    if (!response.isSuccess) {
      const errorMessage = response.info || "Message rejected";
      log.error("Remote peer rejected the message: ", errorMessage);

      // Use pattern matching to determine the appropriate error type
      const error = mapInfoToProtocolError(response.info);

      return {
        success: null,
        failure: {
          error: error,
          peerId: peerId
        },
        protocolUsed: LightPushCodec
      };
    }

    return {
      success: peerId,
      failure: null,
      protocolUsed: LightPushCodec
    };
  }
}

export const LightPushCoreV2 = LightPushCore;
export { PushResponse };

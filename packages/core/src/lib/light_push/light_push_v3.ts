import type { PeerId, Stream } from "@libp2p/interface";
import {
  type CoreProtocolResultWithMeta,
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

import { StreamManager } from "../stream_manager/index.js";

import { PushRpcV3 } from "./push_rpc_v3.js";
import {
  getLightPushStatusDescriptionV3,
  lightPushStatusCodeToProtocolErrorV3
} from "./status_codes_v3.js";
import { isRLNResponseError } from "./utils.js";

const log = new Logger("light-push-v3");

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidRequestId(requestId: string | undefined): boolean {
  if (!requestId) return false;
  if (requestId === "N/A") return true;
  return UUID_REGEX.test(requestId);
}

const STREAM_TIMEOUT_MS = 30000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error("Stream operation timed out")),
        timeoutMs
      )
    )
  ]);
}

type PreparePushMessageResult = ThisOrThat<"query", PushRpcV3>;

export class LightPushCoreV3 {
  private readonly streamManager: StreamManager;

  public readonly multicodec = LightPushCodecV3;

  public constructor(
    public readonly pubsubTopics: PubsubTopic[],
    libp2p: Libp2p
  ) {
    this.streamManager = new StreamManager(LightPushCodecV3, libp2p.components);
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
        protocolUsed: LightPushCodecV3
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
        protocolUsed: LightPushCodecV3
      };
    }

    let res: Uint8ArrayList[] | undefined;
    try {
      res = await withTimeout(
        pipe(
          [query.encode()],
          lp.encode,
          stream,
          lp.decode,
          async (source) => await all(source)
        ),
        STREAM_TIMEOUT_MS
      );
    } catch (err) {
      log.error("Failed to send waku light push request", err);
      return {
        success: null,
        failure: {
          error: ProtocolError.STREAM_ABORTED,
          peerId: peerId
        },
        protocolUsed: LightPushCodecV3
      };
    } finally {
      if (stream) {
        void stream.close();
      }
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
        },
        protocolUsed: LightPushCodecV3
      };
    }

    if (!response) {
      log.error("Remote peer fault: No response received");
      return {
        success: null,
        failure: {
          error: ProtocolError.NO_RESPONSE,
          peerId: peerId
        },
        protocolUsed: LightPushCodecV3
      };
    }

    if (!isValidRequestId(response.requestId)) {
      log.error("Invalid request ID format", {
        received: response.requestId
      });
      return {
        success: null,
        failure: {
          error: ProtocolError.DECODE_FAILED,
          peerId: peerId
        },
        protocolUsed: LightPushCodecV3,
        requestId: response.requestId,
        statusCode: response.statusCode
      };
    }

    if (response.requestId !== query.query?.requestId) {
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
          },
          protocolUsed: LightPushCodecV3,
          requestId: response.requestId,
          statusCode: response.statusCode
        };
      }
    }

    const statusCode = response.statusCode;
    const isSuccess = isSuccessStatusCodeV3(statusCode);

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
        },
        protocolUsed: LightPushCodecV3,
        requestId: response.requestId,
        statusCode: response.statusCode,
        statusDesc: response.statusDesc
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
        },
        protocolUsed: LightPushCodecV3,
        requestId: response.requestId,
        statusCode: response.statusCode,
        statusDesc: response.statusDesc,
        relayPeerCount: response.relayPeerCount
      };
    }

    return {
      success: peerId,
      failure: null,
      protocolUsed: LightPushCodecV3,
      requestId: response.requestId,
      statusCode: response.statusCode,
      statusDesc: response.statusDesc,
      relayPeerCount: response.relayPeerCount
    };
  }
}

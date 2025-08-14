import type { PeerId, Stream } from "@libp2p/interface";
import {
  type IEncoder,
  type IMessage,
  type Libp2p,
  type LightPushCoreResult,
  LightPushError
} from "@waku/interfaces";
import { PushResponse } from "@waku/proto";
import { Logger } from "@waku/utils";
import all from "it-all";
import * as lp from "it-length-prefixed";
import { pipe } from "it-pipe";
import { Uint8ArrayList } from "uint8arraylist";

import { StreamManager } from "../stream_manager/index.js";

import { CODECS, ProtocolHandler } from "./protocol_handler.js";

const log = new Logger("light-push");

export { PushResponse };

export const LightPushCodec = CODECS.v3;
export const LightPushCodecV2 = CODECS.v2;

/**
 * Implements the [Waku v2 Light Push protocol](https://rfc.vac.dev/spec/19/).
 */
export class LightPushCore {
  private readonly streamManager: StreamManager;
  private readonly streamManagerV2: StreamManager;
  public readonly multicodec = [CODECS.v3, CODECS.v2];

  public constructor(private libp2p: Libp2p) {
    this.streamManager = new StreamManager(CODECS.v3, libp2p.components);
    this.streamManagerV2 = new StreamManager(CODECS.v2, libp2p.components);
  }

  public async send(
    encoder: IEncoder,
    message: IMessage,
    peerId: PeerId
  ): Promise<LightPushCoreResult> {
    let stream: Stream | undefined;
    let protocol: string;

    try {
      const peer = await this.libp2p.peerStore.get(peerId);

      if (peer.protocols.includes(CODECS.v3)) {
        stream = await this.streamManager.getStream(peerId);
        protocol = CODECS.v3;
      } else {
        stream = await this.streamManagerV2.getStream(peerId);
        protocol = CODECS.v2;
      }
    } catch (error) {
      log.error("Failed to get stream", error);
      return {
        success: null,
        failure: {
          error: LightPushError.GENERIC_FAIL,
          peerId
        }
      };
    }

    if (!stream) {
      log.error(`Failed to get a stream for remote peer:${peerId.toString()}`);
      return {
        success: null,
        failure: {
          error: LightPushError.NO_STREAM_AVAILABLE,
          peerId: peerId
        }
      };
    }

    const { rpc, error: prepError } = await ProtocolHandler.preparePushMessage(
      encoder,
      message,
      protocol
    );

    if (prepError || !rpc) {
      return {
        success: null,
        failure: {
          error: prepError ?? LightPushError.GENERIC_FAIL,
          peerId
        }
      };
    }

    let res: Uint8ArrayList[] | undefined;
    try {
      res = await pipe(
        [rpc.encode()],
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
          error: LightPushError.STREAM_ABORTED,
          peerId: peerId
        }
      };
    }

    const bytes = new Uint8ArrayList();
    res.forEach((chunk) => bytes.append(chunk));

    if (bytes.length === 0) {
      return {
        success: null,
        failure: {
          error: LightPushError.NO_RESPONSE,
          peerId: peerId
        }
      };
    }

    return ProtocolHandler.handleResponse(bytes, protocol, peerId);
  }
}

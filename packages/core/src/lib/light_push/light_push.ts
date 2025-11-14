import type { PeerId, Stream } from "@libp2p/interface";
import {
  type IEncoder,
  type IMessage,
  type Libp2p,
  type LightPushCoreResult,
  LightPushError
} from "@waku/interfaces";
import { Logger } from "@waku/utils";
import all from "it-all";
import * as lp from "it-length-prefixed";
import { pipe } from "it-pipe";
import { Uint8ArrayList } from "uint8arraylist";

import { StreamManager } from "../stream_manager/index.js";

import { CODECS } from "./constants.js";
import { ProtocolHandler } from "./protocol_handler.js";

const log = new Logger("light-push");

/**
 * Implements the [Waku v2 Light Push protocol](https://rfc.vac.dev/spec/19/).
 */
export class LightPushCore {
  private readonly streamManager: StreamManager;
  private readonly streamManagerV2: StreamManager;

  public readonly multicodec = [CODECS.v3, CODECS.v2];

  public constructor(private libp2p: Libp2p) {
    this.streamManagerV2 = new StreamManager(CODECS.v2, libp2p.components);
    this.streamManager = new StreamManager(CODECS.v3, libp2p.components);
  }

  public stop(): void {
    this.streamManager.stop();
    this.streamManagerV2.stop();
  }

  public async send(
    encoder: IEncoder,
    message: IMessage,
    peerId: PeerId,
    useLegacy: boolean = false
  ): Promise<LightPushCoreResult> {
    const protocol = await this.getProtocol(peerId, useLegacy);

    log.info(
      `Sending light push request to peer:${peerId.toString()}, protocol:${protocol}`
    );

    if (!protocol) {
      return {
        success: null,
        failure: {
          error: LightPushError.GENERIC_FAIL,
          peerId
        }
      };
    }

    const {
      rpc,
      error: prepError,
      message: protoMessage
    } = await ProtocolHandler.preparePushMessage(encoder, message, protocol);

    if (prepError) {
      return {
        success: null,
        failure: {
          error: prepError,
          peerId
        }
      };
    }

    const stream = await this.getStream(peerId, protocol);

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

    const processedResponse = ProtocolHandler.handleResponse(
      bytes,
      protocol,
      peerId
    );

    if (processedResponse.success) {
      return {
        success: processedResponse.success,
        failure: null,
        message: protoMessage
      };
    }

    return processedResponse;
  }

  private async getProtocol(
    peerId: PeerId,
    useLegacy: boolean
  ): Promise<string | undefined> {
    try {
      const peer = await this.libp2p.peerStore.get(peerId);

      if (
        useLegacy ||
        (!peer.protocols.includes(CODECS.v3) &&
          peer.protocols.includes(CODECS.v2))
      ) {
        return CODECS.v2;
      } else if (peer.protocols.includes(CODECS.v3)) {
        return CODECS.v3;
      } else {
        throw new Error("No supported protocol found");
      }
    } catch (error) {
      log.error("Failed to get protocol", error);
      return undefined;
    }
  }

  private async getStream(
    peerId: PeerId,
    protocol: string
  ): Promise<Stream | undefined> {
    switch (protocol) {
      case CODECS.v2:
        return this.streamManagerV2.getStream(peerId);
      case CODECS.v3:
        return this.streamManager.getStream(peerId);
      default:
        return undefined;
    }
  }
}

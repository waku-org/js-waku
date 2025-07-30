import type { PeerId } from "@libp2p/interface";
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

import { CODECS, ProtocolHandler } from "./public.js";

const log = new Logger("light-push");

export const LightPushCodecV2 = CODECS.v2;
export const LightPushCodec = CODECS.v3;
export const LightPushCodecs = [LightPushCodec, LightPushCodecV2];
export { PushResponse };

/**
 * Implements the [Waku v2 Light Push protocol](https://rfc.vac.dev/spec/19/).
 */
export class LightPushCore {
  private readonly streamManager: StreamManager;

  public readonly multicodec = CODECS.v2;
  public readonly multicodecs = LightPushCodecs;

  public constructor(private libp2p: Libp2p) {
    this.streamManager = new StreamManager(CODECS.v2, libp2p.components);
  }

  private async getStream(
    peerId: PeerId
  ): Promise<{ stream: Stream; protocol: string }> {
    const peer = await this.libp2p.peerStore.get(peerId);
    const connections = this.libp2p.getConnections(peerId);
    const connection = connections.find((conn) => conn.status === "open");

    if (!connection) {
      throw new Error("No open connection to peer");
    }

    // Try v3 first if supported
    if (peer.protocols.includes(CODECS.v3)) {
      try {
        const stream = await connection.newStream(CODECS.v3);
        return { stream, protocol: CODECS.v3 };
      } catch (error) {
        log.info(
          `Failed to create v3 stream for peer ${peerId}, falling back to v2`
        );
      }
    }

    // Fall back to v2
    if (peer.protocols.includes(CODECS.v2)) {
      const stream = await this.streamManager.getStream(peerId);
      return { stream, protocol: CODECS.v2 };
    }

    throw new Error("Peer does not support any Light Push protocol");
  }

  public async send(
    encoder: IEncoder,
    message: IMessage,
    peerId: PeerId
  ): Promise<LightPushCoreResult> {
    if (!this.isTopicConfigured(encoder.pubsubTopic)) {
      log.error(
        `Pubsub topic ${encoder.pubsubTopic} is not configured, aborting send`
      );
      return {
        success: null,
        failure: {
          error: LightPushError.TOPIC_NOT_CONFIGURED,
          peerId
        }
      };
    }
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

    const stream = await this.streamManager.getStream(peerId);

    if (!stream) {
      log.error(`Failed to get a stream for remote peer:${peerId.toString()}`);
      return {
        success: null,
        failure: {
          error: ProtocolError.NO_STREAM_AVAILABLE,
          peerId: peerId
        }
      };
    }

    // Prepare versioned RPC using the ProtocolHandler abstraction
    const { rpc, error: prepError } = await ProtocolHandler.processMessage(
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

import type { Libp2p } from "@libp2p/interface-libp2p";
import type { PeerId } from "@libp2p/interface-peer-id";
import type { Peer } from "@libp2p/interface-peer-store";
import type { PeerStore } from "@libp2p/interface-peer-store";
import type {
  IEncoder,
  ILightPush,
  IMessage,
  ProtocolCreateOptions,
  ProtocolOptions,
  SendResult,
} from "@waku/interfaces";
import { PushResponse } from "@waku/proto";
import {
  getPeersForProtocol,
  selectConnection,
  selectPeerForProtocol,
  selectRandomPeer,
} from "@waku/utils/libp2p";
import debug from "debug";
import all from "it-all";
import * as lp from "it-length-prefixed";
import { pipe } from "it-pipe";
import { Uint8ArrayList } from "uint8arraylist";

import { DefaultPubSubTopic } from "../constants.js";

import { PushRPC } from "./push_rpc.js";

const log = debug("waku:light-push");

export const LightPushCodec = "/vac/waku/lightpush/2.0.0-beta1";
export { PushResponse };

/**
 * Implements the [Waku v2 Light Push protocol](https://rfc.vac.dev/spec/19/).
 */
class LightPush implements ILightPush {
  multicodec: string;
  options: ProtocolCreateOptions;

  constructor(public libp2p: Libp2p, options?: ProtocolCreateOptions) {
    this.multicodec = LightPushCodec;
    this.options = options || {};
  }

  async push(
    encoder: IEncoder,
    message: IMessage,
    opts?: ProtocolOptions
  ): Promise<SendResult> {
    const { pubSubTopic = DefaultPubSubTopic } = this.options;

    const res = await selectPeerForProtocol(
      this.peerStore,
      [this.multicodec],
      opts?.peerId
    );

    if (!res) {
      throw new Error("Failed to get a peer");
    }
    const { peer } = res;

    const connections = this.libp2p.getConnections(peer.id);
    const connection = selectConnection(connections);

    if (!connection) throw "Failed to get a connection to the peer";

    const stream = await connection.newStream(LightPushCodec);

    const recipients: PeerId[] = [];

    try {
      const protoMessage = await encoder.toProtoObj(message);
      if (!protoMessage) {
        log("Failed to encode to protoMessage, aborting push");
        return { recipients };
      }
      const query = PushRPC.createRequest(protoMessage, pubSubTopic);
      const res = await pipe(
        [query.encode()],
        lp.encode(),
        stream,
        lp.decode(),
        async (source) => await all(source)
      );
      try {
        const bytes = new Uint8ArrayList();
        res.forEach((chunk) => {
          bytes.append(chunk);
        });

        const response = PushRPC.decode(bytes).response;

        if (!response) {
          log("No response in PushRPC");
          return { recipients };
        }

        if (response.isSuccess) {
          recipients.push(peer.id);
        }
      } catch (err) {
        log("Failed to decode push reply", err);
      }
    } catch (err) {
      log("Failed to send waku light push request", err);
    }
    return { recipients };
  }

  /**
   * Returns known peers from the address book (`libp2p.peerStore`) that support
   * light push protocol. Waku may or may not be currently connected to these
   * peers.
   */
  async peers(): Promise<Peer[]> {
    return getPeersForProtocol(this.peerStore, [LightPushCodec]);
  }

  /**
   * Returns a random peer that supports light push protocol from the address
   * book (`libp2p.peerStore`). Waku may or  may not be currently connected to
   * this peer.
   */
  async randomPeer(): Promise<Peer | undefined> {
    return selectRandomPeer(await this.peers());
  }

  get peerStore(): PeerStore {
    return this.libp2p.peerStore;
  }
}

export function wakuLightPush(
  init: Partial<ProtocolCreateOptions> = {}
): (libp2p: Libp2p) => ILightPush {
  return (libp2p: Libp2p) => new LightPush(libp2p, init);
}

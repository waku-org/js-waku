import type { Stream } from "@libp2p/interface-connection";
import type { Libp2p } from "@libp2p/interface-libp2p";
import type { PeerId } from "@libp2p/interface-peer-id";
import type { PeerStore } from "@libp2p/interface-peer-store";
import type { Peer } from "@libp2p/interface-peer-store";
import type { IncomingStreamData } from "@libp2p/interface-registrar";
import type {
  Callback,
  IDecodedMessage,
  IDecoder,
  IFilter,
  IMessage,
  ProtocolCreateOptions,
  ProtocolOptions,
} from "@waku/interfaces";
import { WakuMessage as WakuMessageProto } from "@waku/proto";
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

import { DefaultPubSubTopic } from "../constants.js";
import { groupByContentTopic } from "../group_by.js";
import { toProtoMessage } from "../to_proto_message.js";

import { ContentFilter, FilterRPC } from "./filter_rpc.js";

export { ContentFilter };

export const FilterCodec = "/vac/waku/filter/2.0.0-beta1";

const log = debug("waku:filter");

export type UnsubscribeFunction = () => Promise<void>;

/**
 * Implements client side of the [Waku v2 Filter protocol](https://rfc.vac.dev/spec/12/).
 *
 * Note this currently only works in NodeJS when the Waku node is listening on a port, see:
 * - https://github.com/status-im/go-waku/issues/245
 * - https://github.com/status-im/nwaku/issues/948
 */
class Filter implements IFilter {
  multicodec: string;
  options: ProtocolCreateOptions;
  private subscriptions: Map<string, Callback<any>>;
  private decoders: Map<
    string, // content topic
    Set<IDecoder<any>>
  >;

  constructor(public libp2p: Libp2p, options?: ProtocolCreateOptions) {
    this.options = options ?? {};
    this.multicodec = FilterCodec;
    this.subscriptions = new Map();
    this.decoders = new Map();
    this.libp2p
      .handle(FilterCodec, this.onRequest.bind(this))
      .catch((e) => log("Failed to register filter protocol", e));
  }

  /**
   * @param decoders Array of Decoders to use to decode messages, it also specifies the content topics.
   * @param callback A function that will be called on each message returned by the filter.
   * @param opts The FilterSubscriptionOpts used to narrow which messages are returned, and which peer to connect to.
   * @returns Unsubscribe function that can be used to end the subscription.
   */
  async subscribe<T extends IDecodedMessage>(
    decoders: IDecoder<T>[],
    callback: Callback<T>,
    opts?: ProtocolOptions
  ): Promise<UnsubscribeFunction> {
    const { pubSubTopic = DefaultPubSubTopic } = this.options;

    const groupedDecoders = groupByContentTopic(decoders);
    const contentTopics = Array.from(groupedDecoders.keys());

    const contentFilters = contentTopics.map((contentTopic) => ({
      contentTopic,
    }));
    const request = FilterRPC.createRequest(
      pubSubTopic,
      contentFilters,
      undefined,
      true
    );

    const requestId = request.requestId;
    if (!requestId)
      throw new Error(
        "Internal error: createRequest expected to set `requestId`"
      );

    const peer = await this.getPeer(opts?.peerId);
    const stream = await this.newStream(peer);

    try {
      const res = await pipe(
        [request.encode()],
        lp.encode(),
        stream,
        lp.decode(),
        async (source) => await all(source)
      );

      log("response", res);
    } catch (e) {
      log(
        "Error subscribing to peer ",
        peer.id.toString(),
        "for content topics",
        contentTopics,
        ": ",
        e
      );
      throw e;
    }

    this.addDecoders(groupedDecoders);
    this.addCallback(requestId, callback);

    return async () => {
      await this.unsubscribe(pubSubTopic, contentFilters, requestId, peer);
      this.deleteDecoders(groupedDecoders);
      this.deleteCallback(requestId);
    };
  }

  get peerStore(): PeerStore {
    return this.libp2p.peerStore;
  }

  private onRequest(streamData: IncomingStreamData): void {
    log("Receiving message push");
    try {
      pipe(streamData.stream, lp.decode(), async (source) => {
        for await (const bytes of source) {
          const res = FilterRPC.decode(bytes.slice());
          if (res.requestId && res.push?.messages?.length) {
            await this.pushMessages(res.requestId, res.push.messages);
          }
        }
      }).then(
        () => {
          log("Receiving pipe closed.");
        },
        (e) => {
          log("Error with receiving pipe", e);
        }
      );
    } catch (e) {
      log("Error decoding message", e);
    }
  }

  private async pushMessages(
    requestId: string,
    messages: WakuMessageProto[]
  ): Promise<void> {
    const callback = this.subscriptions.get(requestId);
    if (!callback) {
      log(`No callback registered for request ID ${requestId}`);
      return;
    }

    for (const protoMessage of messages) {
      const contentTopic = protoMessage.contentTopic;
      if (!contentTopic) {
        log("Message has no content topic, skipping");
        return;
      }

      const decoders = this.decoders.get(contentTopic);
      if (!decoders) {
        log("No decoder for", contentTopic);
        return;
      }

      let msg: IMessage | undefined;
      // We don't want to wait for decoding failure, just attempt to decode
      // all messages and do the call back on the one that works
      // noinspection ES6MissingAwait
      decoders.forEach(async (dec) => {
        if (msg) return;
        const decoded = await dec.fromProtoObj(toProtoMessage(protoMessage));
        if (!decoded) {
          log("Not able to decode message");
          return;
        }
        // This is just to prevent more decoding attempt
        // TODO: Could be better if we were to abort promises
        msg = decoded;
        await callback(decoded);
      });
    }
  }

  private addCallback(requestId: string, callback: Callback<any>): void {
    this.subscriptions.set(requestId, callback);
  }

  private deleteCallback(requestId: string): void {
    this.subscriptions.delete(requestId);
  }

  private addDecoders<T extends IDecodedMessage>(
    decoders: Map<string, Array<IDecoder<T>>>
  ): void {
    decoders.forEach((decoders, contentTopic) => {
      const currDecs = this.decoders.get(contentTopic);
      if (!currDecs) {
        this.decoders.set(contentTopic, new Set(decoders));
      } else {
        this.decoders.set(contentTopic, new Set([...currDecs, ...decoders]));
      }
    });
  }

  private deleteDecoders<T extends IDecodedMessage>(
    decoders: Map<string, Array<IDecoder<T>>>
  ): void {
    decoders.forEach((decoders, contentTopic) => {
      const currDecs = this.decoders.get(contentTopic);
      if (currDecs) {
        decoders.forEach((dec) => {
          currDecs.delete(dec);
        });
      }
    });
  }

  private async unsubscribe(
    topic: string,
    contentFilters: ContentFilter[],
    requestId: string,
    peer: Peer
  ): Promise<void> {
    const unsubscribeRequest = FilterRPC.createRequest(
      topic,
      contentFilters,
      requestId,
      false
    );

    const stream = await this.newStream(peer);
    try {
      await pipe([unsubscribeRequest.encode()], lp.encode(), stream.sink);
    } catch (e) {
      log("Error unsubscribing", e);
      throw e;
    }
  }

  private async newStream(peer: Peer): Promise<Stream> {
    const connections = this.libp2p.getConnections(peer.id);
    const connection = selectConnection(connections);
    if (!connection) {
      throw new Error("Failed to get a connection to the peer");
    }

    return connection.newStream(FilterCodec);
  }

  private async getPeer(peerId?: PeerId): Promise<Peer> {
    const res = await selectPeerForProtocol(
      this.peerStore,
      [FilterCodec],
      peerId
    );
    if (!res) {
      throw new Error(`Failed to select peer for ${FilterCodec}`);
    }
    return res.peer;
  }

  async peers(): Promise<Peer[]> {
    return getPeersForProtocol(this.peerStore, [FilterCodec]);
  }

  async randomPeer(): Promise<Peer | undefined> {
    return selectRandomPeer(await this.peers());
  }
}

export function wakuFilter(
  init: Partial<ProtocolCreateOptions> = {}
): (libp2p: Libp2p) => IFilter {
  return (libp2p: Libp2p) => new Filter(libp2p, init);
}

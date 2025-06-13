/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-member-accessibility */
/* eslint-disable @typescript-eslint/no-this-alias */
import type { PeerId } from "@libp2p/interface";
import { BaseProtocol } from "@waku/core/lib/base_protocol";
import { EnrDecoder } from "@waku/enr";
import type {
  Libp2pComponents as ILibp2pComponents,
  PubsubTopic,
  PeerInfo as WakuPeerInfo
} from "@waku/interfaces";
import { isDefined } from "@waku/utils";
import { Context, Effect, Layer } from "effect";
import all from "it-all";
import * as lp from "it-length-prefixed";
import { pipe } from "it-pipe";
import { Uint8ArrayList } from "uint8arraylist";

import { PeerExchangeRPC } from "../../../peer-exchange/rpc.js";
import {
  ProtocolError as EffectProtocolError,
  PeerExchangeError
} from "../common/errors.js";

export const PeerExchangeCodec = "/vac/waku/peer-exchange/2.0.0-alpha1";

/**
 * Peer Exchange query parameters
 */
export interface PeerExchangeQueryParams {
  readonly peerId: PeerId;
  readonly numPeers: number;
}

/**
 * Peer Exchange query result
 */
export interface PeerExchangeQueryResult {
  readonly peerInfos: readonly WakuPeerInfo[];
}

/**
 * Peer Exchange Protocol service
 */
export interface PeerExchangeProtocolService {
  readonly query: (
    params: PeerExchangeQueryParams
  ) => Effect.Effect<
    PeerExchangeQueryResult,
    PeerExchangeError | EffectProtocolError
  >;
}

/**
 * Peer Exchange Protocol tag
 */
export const PeerExchangeProtocol =
  Context.GenericTag<PeerExchangeProtocolService>("PeerExchangeProtocol");

/**
 * Peer Exchange Protocol implementation
 */
class PeerExchangeProtocolImpl extends BaseProtocol {
  constructor(components: ILibp2pComponents, pubsubTopics: PubsubTopic[]) {
    super(PeerExchangeCodec, components, pubsubTopics);
  }

  query(
    params: PeerExchangeQueryParams
  ): Effect.Effect<
    PeerExchangeQueryResult,
    PeerExchangeError | EffectProtocolError
  > {
    const self = this;
    return Effect.gen(function* () {
      const { numPeers, peerId } = params;

      // Create RPC request
      const rpcQuery = PeerExchangeRPC.createRequest({
        numPeers: BigInt(numPeers)
      });

      // Check if peer exists
      const peerExists = yield* Effect.tryPromise({
        try: () => (self as any).components.peerStore.has(peerId),
        catch: () =>
          new PeerExchangeError({
            peer: peerId,
            operation: "query",
            reason: "Failed to check peer store"
          })
      });

      if (!peerExists) {
        return yield* Effect.fail(
          new EffectProtocolError({
            protocol: PeerExchangeCodec,
            reason: "Peer not found in peer store"
          })
        );
      }

      // Get stream
      const stream = yield* Effect.tryPromise({
        try: () => self.getStream(peerId),
        catch: (error) =>
          new PeerExchangeError({
            peer: peerId,
            operation: "query",
            reason: "Failed to establish stream",
            cause: error
          })
      });

      // Send query and receive response
      const response = yield* Effect.tryPromise({
        try: async () => {
          const res = await pipe(
            [rpcQuery.encode()],
            lp.encode,
            stream,
            lp.decode,
            async (source) => await all(source)
          );

          const bytes = new Uint8ArrayList();
          res.forEach((chunk) => bytes.append(chunk));

          return PeerExchangeRPC.decode(bytes);
        },
        catch: (error) =>
          new PeerExchangeError({
            peer: peerId,
            operation: "decode",
            reason: "Failed to decode response",
            cause: error
          })
      });

      if (!response.response) {
        return yield* Effect.fail(
          new EffectProtocolError({
            protocol: PeerExchangeCodec,
            reason: "Response did not contain a 'response' field"
          })
        );
      }

      // Decode ENRs
      const peerInfos = yield* Effect.forEach(
        response.response.peerInfos
          .map((peerInfo) => peerInfo.enr)
          .filter(isDefined),
        (enr) =>
          Effect.tryPromise({
            try: async () =>
              ({
                ENR: await EnrDecoder.fromRLP(enr)
              }) as WakuPeerInfo,
            catch: (error) =>
              new PeerExchangeError({
                peer: peerId,
                operation: "decode",
                reason: "Failed to decode ENR",
                cause: error
              })
          }).pipe(Effect.orElseSucceed(() => null)),
        { concurrency: "unbounded" }
      ).pipe(
        Effect.map((results) =>
          results.filter((info): info is WakuPeerInfo => info !== null)
        )
      );

      return { peerInfos } as PeerExchangeQueryResult;
    });
  }
}

/**
 * Libp2p Components service tag
 */
export const Libp2pComponents: Context.Tag<
  ILibp2pComponents,
  ILibp2pComponents
> = Context.GenericTag<ILibp2pComponents>("Libp2pComponents");

/**
 * Create Peer Exchange Protocol layer
 */
export const PeerExchangeProtocolLive: (
  pubsubTopics: PubsubTopic[]
) => Layer.Layer<PeerExchangeProtocolService, never, ILibp2pComponents> = (
  pubsubTopics
) =>
  Layer.effect(
    PeerExchangeProtocol,
    Effect.gen(function* () {
      const components = yield* Libp2pComponents;
      const protocol = new PeerExchangeProtocolImpl(components, pubsubTopics);

      return {
        query: (params) => protocol.query(params)
      } satisfies PeerExchangeProtocolService;
    })
  );
